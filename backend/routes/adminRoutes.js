const express = require("express");
const mongoose = require("mongoose");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const { requireAuth } = require("../middleware/auth");
const roleGuard = require("../middleware/roleGuard");
const User = require("../models/User");
const Bookmark = require("../models/Bookmark");
const Note = require("../models/Note");
const TasbeehSession = require("../models/TasbeehSession");
const ReadingProgress = require("../models/ReadingProgress");
const Announcement = require("../models/Announcement");
const Notification = require("../models/Notification");
const ErrorLog = require("../models/ErrorLog");
const Dua = require("../models/Dua");
const Reminder = require("../models/Reminder");
const ctl = require("../controllers/adminController");
const feedbackCtl = require("../controllers/feedbackController");
const audit = require("../utils/audit");

const router = express.Router();
router.use(requireAuth, roleGuard(["ADMIN", "SUPER_ADMIN"]));

const httpError = (msg, code) => Object.assign(new Error(msg), { statusCode: code });

// ---- Dashboard statistics ----
router.get("/stats", asyncHandler(async (req, res) => {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [totalUsers, activeUsers, bookmarks, notes, tasbeehSessions, readers, newUsers7d] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ isActive: true }),
    Bookmark.countDocuments(),
    Note.countDocuments(),
    TasbeehSession.countDocuments(),
    ReadingProgress.countDocuments({ lastReadAt: { $ne: null } }),
    User.countDocuments({ createdAt: { $gte: since } }),
  ]);

  // Sign-ups per day for the last 7 days
  const perDay = await User.aggregate([
    { $match: { createdAt: { $gte: since } } },
    { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  return sendSuccess(res, {
    message: "Admin stats",
    data: { totalUsers, activeUsers, bookmarks, notes, tasbeehSessions, readers, newUsers7d, signupsPerDay: perDay },
  });
}));

// ---- Users ----
router.get("/users", asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = 20;
  const filter = {};
  if (req.query.q) {
    const rx = new RegExp(String(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ name: rx }, { email: rx }];
  }
  if (["USER", "ADMIN", "SUPER_ADMIN"].includes(req.query.role)) filter.role = req.query.role;
  if (req.query.status === "active") filter.isActive = true;
  if (req.query.status === "inactive") filter.isActive = false;
  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    User.countDocuments(filter),
  ]);
  return sendSuccess(res, { message: "Users", data: { users, total, page, pages: Math.ceil(total / limit) } });
}));

router.patch("/users/:id/active", asyncHandler(async (req, res) => {
  const target = await User.findById(req.params.id);
  if (!target) throw httpError("User not found", 404);
  if (String(target._id) === req.user.id) throw httpError("You cannot deactivate your own account", 400);
  if (target.role !== "USER" && req.user.role !== "SUPER_ADMIN") throw httpError("Only a Super Admin can change administrators", 403);
  target.isActive = Boolean(req.body.isActive);
  await target.save();
  audit(req, target.isActive ? "USER_ACTIVATE" : "USER_DEACTIVATE", target.email);
  return sendSuccess(res, { message: "User updated", data: { user: target } });
}));

// Only SUPER_ADMIN can manage roles
router.patch("/users/:id/role", roleGuard(["SUPER_ADMIN"]), asyncHandler(async (req, res) => {
  const { role } = req.body;
  if (!["USER", "ADMIN", "SUPER_ADMIN"].includes(role)) throw httpError("Invalid role", 400);
  const target = await User.findById(req.params.id);
  if (!target) throw httpError("User not found", 404);
  if (String(target._id) === req.user.id) throw httpError("You cannot change your own role", 400);
  const oldRole = target.role;
  target.role = role;
  await target.save();
  audit(req, "ROLE_CHANGE", target.email, `${oldRole} -> ${role}`);
  return sendSuccess(res, { message: "Role updated", data: { user: target } });
}));

// ---- Announcements (admin-managed content) ----
router.get("/announcements", asyncHandler(async (req, res) => {
  const items = await Announcement.find().sort({ createdAt: -1 });
  return sendSuccess(res, { message: "Announcements", data: { announcements: items } });
}));
router.post("/announcements", asyncHandler(async (req, res) => {
  const { title, body } = req.body;
  if (!title || !body) throw httpError("title and body are required", 400);
  const item = await Announcement.create({ title, body, createdBy: req.user.id });
  return sendSuccess(res, { statusCode: 201, message: "Created", data: { announcement: item } });
}));
router.patch("/announcements/:id", asyncHandler(async (req, res) => {
  const item = await Announcement.findByIdAndUpdate(req.params.id, { isActive: Boolean(req.body.isActive) }, { new: true });
  if (!item) throw httpError("Not found", 404);
  return sendSuccess(res, { message: "Updated", data: { announcement: item } });
}));
router.delete("/announcements/:id", asyncHandler(async (req, res) => {
  await Announcement.findByIdAndDelete(req.params.id);
  return sendSuccess(res, { message: "Deleted" });
}));

// ---- Broadcast an in-app notification to every active user ----
router.post("/notifications/broadcast", asyncHandler(async (req, res) => {
  const title = String(req.body.title || "").trim();
  const body = String(req.body.body || "").trim();
  const link = String(req.body.link || "").trim();
  if (!title || title.length > 120) throw httpError("Title is required (max 120 characters)", 400);
  if (body.length > 500) throw httpError("Body is too long (max 500 characters)", 400);
  if (link && !link.startsWith("/")) throw httpError("Link must be an in-app path such as /quran", 400);

  const users = await User.find({ isActive: true }).select("_id").lean();
  const docs = users.map((u) => ({ user: u._id, type: "ANNOUNCEMENT", title, body, link }));
  // insert in chunks so a large user base does not build one giant request
  for (let i = 0; i < docs.length; i += 1000) {
    await Notification.insertMany(docs.slice(i, i + 1000));
  }
  audit(req, "BROADCAST", title, `sent to ${docs.length} users`);
  return sendSuccess(res, { statusCode: 201, message: `Sent to ${docs.length} users`, data: { sent: docs.length } });
}));

// ---- Error logs (server errors only, auto-deleted after 30 days) ----
router.get("/error-logs", asyncHandler(async (req, res) => {
  const logs = await ErrorLog.find().sort({ createdAt: -1 }).limit(100);
  const last24h = await ErrorLog.countDocuments({ createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } });
  return sendSuccess(res, { message: "Error logs", data: { logs, last24h } });
}));
router.delete("/error-logs", roleGuard(["SUPER_ADMIN"]), asyncHandler(async (req, res) => {
  await ErrorLog.deleteMany({});
  audit(req, "ERROR_LOGS_CLEAR", "error logs");
  return sendSuccess(res, { message: "Error logs cleared" });
}));

// ---- Admin-managed Duas (source is required; canonical Quran/Hadith data is never editable here) ----
const isId = (id) => mongoose.isValidObjectId(id);
function duaFields(body) {
  const f = {
    category: String(body.category || "").trim().toLowerCase(),
    title: String(body.title || "").trim(),
    arabic: String(body.arabic || "").trim(),
    transliteration: String(body.transliteration || "").trim(),
    urdu: String(body.urdu || "").trim(),
    urduMachine: false, // saved by an admin = checked by a person
    english: String(body.english || "").trim(),
    source: String(body.source || "").trim(),
  };
  if (!/^[a-z0-9-]{2,40}$/.test(f.category)) throw httpError("Category must be 2-40 characters: lowercase letters, numbers and dashes (e.g. ramadan)", 400);
  if (!f.arabic) throw httpError("Arabic text is required", 400);
  if (!f.source) throw httpError("A source / reference is required", 400);
  if (!f.english && !f.urdu) throw httpError("Add an English or Urdu translation", 400);
  return f;
}
router.get("/duas", asyncHandler(async (req, res) => {
  const duas = await Dua.find().sort({ createdAt: -1 }).limit(200);
  return sendSuccess(res, { message: "Duas", data: { duas } });
}));
router.post("/duas", asyncHandler(async (req, res) => {
  const dua = await Dua.create({ ...duaFields(req.body), createdBy: req.user.id });
  return sendSuccess(res, { statusCode: 201, message: "Dua created", data: { dua } });
}));
router.put("/duas/:id", asyncHandler(async (req, res) => {
  if (!isId(req.params.id)) throw httpError("Not found", 404);
  const dua = await Dua.findByIdAndUpdate(req.params.id, { $set: duaFields(req.body) }, { new: true });
  if (!dua) throw httpError("Not found", 404);
  return sendSuccess(res, { message: "Dua updated", data: { dua } });
}));
router.patch("/duas/:id", asyncHandler(async (req, res) => {
  if (!isId(req.params.id)) throw httpError("Not found", 404);
  const dua = await Dua.findByIdAndUpdate(req.params.id, { isActive: Boolean(req.body.isActive) }, { new: true });
  if (!dua) throw httpError("Not found", 404);
  return sendSuccess(res, { message: "Dua updated", data: { dua } });
}));
router.delete("/duas/:id", asyncHandler(async (req, res) => {
  if (!isId(req.params.id)) throw httpError("Not found", 404);
  const gone = await Dua.findByIdAndDelete(req.params.id);
  if (gone) audit(req, "DUA_DELETE", gone.category, String(gone.source).slice(0, 100));
  return sendSuccess(res, { message: "Dua deleted" });
}));

// ---- Daily reminders ----
router.get("/reminders", asyncHandler(async (req, res) => {
  const reminders = await Reminder.find().sort({ createdAt: -1 }).limit(200);
  return sendSuccess(res, { message: "Reminders", data: { reminders } });
}));
router.post("/reminders", asyncHandler(async (req, res) => {
  const text = String(req.body.text || "").trim();
  const source = String(req.body.source || "").trim();
  if (!text || text.length > 400) throw httpError("Text is required (max 400 characters)", 400);
  if (!source || source.length > 300) throw httpError("A source / reference is required", 400);
  const reminder = await Reminder.create({ text, source, createdBy: req.user.id });
  return sendSuccess(res, { statusCode: 201, message: "Reminder created", data: { reminder } });
}));
router.patch("/reminders/:id", asyncHandler(async (req, res) => {
  if (!isId(req.params.id)) throw httpError("Not found", 404);
  const reminder = await Reminder.findByIdAndUpdate(req.params.id, { isActive: Boolean(req.body.isActive) }, { new: true });
  if (!reminder) throw httpError("Not found", 404);
  return sendSuccess(res, { message: "Reminder updated", data: { reminder } });
}));
router.delete("/reminders/:id", asyncHandler(async (req, res) => {
  if (!isId(req.params.id)) throw httpError("Not found", 404);
  await Reminder.findByIdAndDelete(req.params.id);
  return sendSuccess(res, { message: "Reminder deleted" });
}));

// ---- Phase 17: overview, user details, sources, reports, settings, status, audit ----
router.get("/overview", ctl.overview);
router.get("/users/:id", ctl.userDetail);
router.get("/sources", ctl.sources);
router.post("/cache/clear", roleGuard(["SUPER_ADMIN"]), ctl.clearCache);
router.get("/dua-categories", ctl.duaCategories);
router.get("/settings", ctl.getAdminSettings);
router.put("/settings", roleGuard(["SUPER_ADMIN"]), ctl.putAdminSettings);
router.get("/reports", ctl.reports);
router.get("/audit-log", ctl.auditLog);
router.get("/notifications/history", ctl.broadcastHistory);
router.get("/api-status", ctl.apiStatus);
router.get("/system", ctl.systemStatus); // no secrets are exposed

// ---- Phase 30: user feedback ----
router.get("/feedback/summary", feedbackCtl.adminSummary);
router.get("/feedback", feedbackCtl.adminList);
router.patch("/feedback/:id", feedbackCtl.adminSetStatus);
router.delete("/feedback/:id", feedbackCtl.adminDelete);

module.exports = router;
