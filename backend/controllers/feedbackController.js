const mongoose = require("mongoose");
const Feedback = require("../models/Feedback");
const { validateFeedback, TYPES } = require("../utils/feedbackValidate");
const asyncHandler = require("../utils/asyncHandler");
const httpError = require("../utils/httpError");
const audit = require("../utils/audit");
const { sendSuccess } = require("../utils/apiResponse");

const isId = (id) => mongoose.Types.ObjectId.isValid(id);

// POST /api/feedback  (login required)
const submit = asyncHandler(async (req, res) => {
  const { value, error } = validateFeedback(req.body);
  if (error) throw httpError(400, error);
  const feedback = await Feedback.create({ ...value, user: req.user.id });
  return sendSuccess(res, { statusCode: 201, message: "Thank you for your feedback", data: { feedback } });
});

// GET /api/feedback/mine  (only your own feedback)
const mine = asyncHandler(async (req, res) => {
  const items = await Feedback.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(20).lean();
  return sendSuccess(res, { message: "Your feedback", data: { feedback: items } });
});

// ---- Admin (mounted in adminRoutes.js, behind the ADMIN / SUPER_ADMIN guard) ----

// GET /api/admin/feedback?type=bug&status=new&rating=1-5&page=1
const adminList = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = 20;
  const filter = {};
  if (TYPES.includes(req.query.type)) filter.type = req.query.type;
  if (["new", "reviewed"].includes(req.query.status)) filter.status = req.query.status;
  const rating = Number(req.query.rating);
  if (Number.isInteger(rating) && rating >= 1 && rating <= 5) filter["ratings.overall"] = rating;

  const [items, total] = await Promise.all([
    Feedback.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate("user", "name email").lean(),
    Feedback.countDocuments(filter),
  ]);
  return sendSuccess(res, { message: "Feedback", data: { feedback: items, total, page, pages: Math.ceil(total / limit) } });
});

// GET /api/admin/feedback/summary  -> counts, average ratings, would-recommend split
const adminSummary = asyncHandler(async (req, res) => {
  const [total, unread, averages, recommend] = await Promise.all([
    Feedback.countDocuments(),
    Feedback.countDocuments({ status: "new" }),
    Feedback.aggregate([{ $group: {
      _id: null,
      overall: { $avg: "$ratings.overall" }, ease: { $avg: "$ratings.ease" },
      quran: { $avg: "$ratings.quran" }, audio: { $avg: "$ratings.audio" },
    } }]),
    Feedback.aggregate([{ $group: { _id: "$recommend", count: { $sum: 1 } } }]),
  ]);
  const round = (n) => (typeof n === "number" ? Math.round(n * 10) / 10 : null);
  const a = averages[0] || {};
  return sendSuccess(res, {
    message: "Feedback summary",
    data: {
      total, unread,
      averages: { overall: round(a.overall), ease: round(a.ease), quran: round(a.quran), audio: round(a.audio) },
      recommend: Object.fromEntries(recommend.map((r) => [r._id, r.count])),
    },
  });
});

// PATCH /api/admin/feedback/:id  { status }
const adminSetStatus = asyncHandler(async (req, res) => {
  if (!isId(req.params.id)) throw httpError(404, "Feedback not found");
  const status = req.body.status;
  if (!["new", "reviewed"].includes(status)) throw httpError(400, "status must be new or reviewed");
  const item = await Feedback.findByIdAndUpdate(req.params.id, { status }, { new: true });
  if (!item) throw httpError(404, "Feedback not found");
  return sendSuccess(res, { message: "Feedback updated", data: { feedback: item } });
});

// DELETE /api/admin/feedback/:id
const adminDelete = asyncHandler(async (req, res) => {
  if (!isId(req.params.id)) throw httpError(404, "Feedback not found");
  const item = await Feedback.findByIdAndDelete(req.params.id);
  if (!item) throw httpError(404, "Feedback not found");
  audit(req, "FEEDBACK_DELETE", String(item._id));
  return sendSuccess(res, { message: "Feedback deleted" });
});

module.exports = { submit, mine, adminList, adminSummary, adminSetStatus, adminDelete };
