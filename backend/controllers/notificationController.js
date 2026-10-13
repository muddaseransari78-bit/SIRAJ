const mongoose = require("mongoose");
const Notification = require("../models/Notification");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");

function notFound() {
  const err = new Error("Notification not found");
  err.statusCode = 404;
  return err;
}

const list = asyncHandler(async (req, res) => {
  const [items, unreadCount] = await Promise.all([
    Notification.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(50),
    Notification.countDocuments({ user: req.user.id, read: false }),
  ]);
  return sendSuccess(res, { message: "Notifications", data: { notifications: items, unreadCount } });
});

const unreadCount = asyncHandler(async (req, res) => {
  const count = await Notification.countDocuments({ user: req.user.id, read: false });
  return sendSuccess(res, { message: "Unread count", data: { unreadCount: count } });
});

const markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ user: req.user.id, read: false }, { $set: { read: true } });
  return sendSuccess(res, { message: "All marked as read" });
});

const markRead = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw notFound();
  const item = await Notification.findOneAndUpdate({ _id: req.params.id, user: req.user.id }, { $set: { read: true } }, { new: true });
  if (!item) throw notFound();
  return sendSuccess(res, { message: "Marked as read", data: { notification: item } });
});

const remove = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw notFound();
  await Notification.deleteOne({ _id: req.params.id, user: req.user.id });
  return sendSuccess(res, { message: "Deleted" });
});

module.exports = { list, unreadCount, markAllRead, markRead, remove };
