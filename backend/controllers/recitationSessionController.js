const mongoose = require("mongoose");
const RecitationSession = require("../models/RecitationSession");
const asyncHandler = require("../utils/asyncHandler");
const httpError = require("../utils/httpError");
const { sendSuccess } = require("../utils/apiResponse");
const { resolveDate } = require("../utils/progressMath");
const { parseSession, summarize, perDay } = require("../utils/recitationHistory");

const MAX_SAVED = 500; // one user can keep at most this many sessions (stops endless growth)

// POST /api/recitation/sessions  { surahNumber, ayahs: [{ ayahNumber, score, problems }], date? }
const createSession = asyncHandler(async (req, res) => {
  const clean = parseSession(req.body);
  const count = await RecitationSession.countDocuments({ user: req.user.id });
  if (count >= MAX_SAVED) throw httpError(400, `You can keep up to ${MAX_SAVED} saved sessions. Delete some old ones first.`);
  const session = await RecitationSession.create({ user: req.user.id, ...clean });
  return sendSuccess(res, { statusCode: 201, message: "Session saved", data: { session } });
});

// GET /api/recitation/sessions?today=YYYY-MM-DD  -> latest 30 sessions + totals + 14-day chart
const listSessions = asyncHandler(async (req, res) => {
  const today = resolveDate(req.query.today);
  const userId = new mongoose.Types.ObjectId(req.user.id);
  const [sessions, totals, recent] = await Promise.all([
    RecitationSession.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(30).lean(),
    // Totals come from the database, so they stay right however many sessions exist
    RecitationSession.aggregate([
      { $match: { user: userId } },
      { $group: { _id: null, sessions: { $sum: 1 }, ayahs: { $sum: { $size: "$ayahs" } }, weighted: { $sum: { $multiply: ["$averageScore", { $size: "$ayahs" }] } } } },
    ]),
    RecitationSession.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(200).select("date ayahs averageScore -_id").lean(),
  ]);
  const t = totals[0];
  return sendSuccess(res, {
    message: "Recitation history",
    data: {
      sessions,
      totals: { sessions: t ? t.sessions : 0, ayahsPracticed: t ? t.ayahs : 0, averageScore: t && t.ayahs ? Math.round(t.weighted / t.ayahs) : 0 },
      last14: perDay(recent, today, 14),
      recentSummary: summarize(recent.slice(0, 10)),
    },
  });
});

// DELETE /api/recitation/sessions/:id
const deleteSession = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw httpError(404, "Session not found");
  const removed = await RecitationSession.findOneAndDelete({ _id: req.params.id, user: req.user.id }); // own sessions only
  if (!removed) throw httpError(404, "Session not found");
  return sendSuccess(res, { message: "Session deleted", data: {} });
});

module.exports = { createSession, listSessions, deleteSession, MAX_SAVED };
