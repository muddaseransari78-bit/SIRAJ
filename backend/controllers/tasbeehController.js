const mongoose = require("mongoose");
const TasbeehSession = require("../models/TasbeehSession");
const asyncHandler = require("../utils/asyncHandler");
const httpError = require("../utils/httpError");
const { sendSuccess } = require("../utils/apiResponse");
const { parseSession, readLocalDate, lastDays } = require("../utils/tasbeeh");

const createSession = asyncHandler(async (req, res) => {
  const clean = parseSession(req.body);
  const session = await TasbeehSession.create({ user: req.user.id, ...clean });
  return sendSuccess(res, { statusCode: 201, message: "Session saved", data: { session } });
});

// History + today's total + 7-day chart + all-time total. Totals are summed in the database
// (not from the 30 sessions shown), so they stay correct however many sessions exist.
const listSessions = asyncHandler(async (req, res) => {
  const today = readLocalDate(req.query.today);
  const userId = new mongoose.Types.ObjectId(req.user.id);
  const days = lastDays(today, 7);

  const [sessions, perDay, allTime, todayByDhikr] = await Promise.all([
    TasbeehSession.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(30),
    TasbeehSession.aggregate([
      { $match: { user: userId, date: { $in: days } } },
      { $group: { _id: "$date", total: { $sum: "$count" } } },
    ]),
    TasbeehSession.aggregate([
      { $match: { user: userId } },
      { $group: { _id: null, total: { $sum: "$count" }, sessions: { $sum: 1 } } },
    ]),
    TasbeehSession.aggregate([
      { $match: { user: userId, date: today } },
      { $group: { _id: "$dhikr", total: { $sum: "$count" } } },
      { $sort: { total: -1 } },
    ]),
  ]);

  const totals = {};
  perDay.forEach((r) => { totals[r._id] = r.total; });
  const last7 = days.map((date) => ({ date, total: totals[date] || 0 }));

  return sendSuccess(res, {
    message: "Tasbeeh history",
    data: {
      sessions,
      todayTotal: totals[today] || 0,
      last7,
      allTimeTotal: allTime[0] ? allTime[0].total : 0,
      allTimeSessions: allTime[0] ? allTime[0].sessions : 0,
      todayByDhikr: todayByDhikr.map((r) => ({ dhikr: r._id, total: r.total })),
    },
  });
});

const deleteSession = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw httpError(400, "Invalid session id");
  // The user id is part of the filter: nobody can delete another person's session
  const removed = await TasbeehSession.findOneAndDelete({ _id: req.params.id, user: req.user.id });
  if (!removed) throw httpError(404, "Session not found");
  return sendSuccess(res, { message: "Session deleted", data: {} });
});

module.exports = { createSession, listSessions, deleteSession };
