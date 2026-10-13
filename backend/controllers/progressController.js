const ReadingProgress = require("../models/ReadingProgress");
const ReadingActivity = require("../models/ReadingActivity");
const quranApi = require("../services/external/quranApi");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const { utcToday, addDays, resolveDate, computeStreaks, lastNDays, computeProgress } = require("../utils/progressMath");

function badRequest(message) {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
}

const isInt = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;

// Records "the user was active on this day" (used for the reading streak)
async function recordActivity(userId, date) {
  await ReadingActivity.updateOne({ user: userId, date }, { $inc: { count: 1 } }, { upsert: true });
}

// Builds everything the Progress page / Dashboard needs in one object
async function buildStats(userId, today) {
  const progress =
    (await ReadingProgress.findOne({ user: userId })) || (await ReadingProgress.create({ user: userId }));

  // Surah metadata (ayah counts) is cached in the backend. If the external API is down we still answer.
  let surahMeta = null;
  try {
    surahMeta = await quranApi.getAllSurahs();
  } catch (err) {
    surahMeta = null;
  }

  const since = addDays(today, -400);
  const activity = await ReadingActivity.find({ user: userId, date: { $gte: since } }).select("date -_id").lean();
  const dates = activity.map((a) => a.date);
  const activeSet = new Set(dates);
  const streak = computeStreaks(dates, today);
  const last7 = lastNDays(today, 7, activeSet);
  const last30 = lastNDays(today, 30, activeSet);

  return {
    lastSurahNumber: progress.lastSurahNumber,
    lastAyahNumber: progress.lastAyahNumber,
    lastReadAt: progress.lastReadAt,
    surahsCompleted: progress.surahsCompleted,
    juzCompleted: progress.juzCompleted,
    khatmCount: progress.khatmCount,
    ...computeProgress({
      surahsCompleted: progress.surahsCompleted,
      juzCompleted: progress.juzCompleted,
      surahMeta,
    }),
    streak,
    last7,
    activeDays30: last30.filter((d) => d.active).length,
  };
}

const getMyProgress = asyncHandler(async (req, res) => {
  let progress = await ReadingProgress.findOne({ user: req.user.id });
  if (!progress) {
    progress = await ReadingProgress.create({ user: req.user.id });
  }
  return sendSuccess(res, { message: "Reading progress", data: { progress } });
});

// GET /api/progress/stats?today=YYYY-MM-DD
const getMyStats = asyncHandler(async (req, res) => {
  const today = resolveDate(req.query.today);
  const stats = await buildStats(req.user.id, today);
  return sendSuccess(res, { message: "Reading statistics", data: { stats } });
});

// PUT /api/progress  { surahNumber, ayahNumber, date? }  -> "mark last read"
const updateMyProgress = asyncHandler(async (req, res) => {
  const { surahNumber, ayahNumber, date } = req.body;

  if (!isInt(surahNumber, 1, 114) || !isInt(ayahNumber, 1, 286)) {
    throw badRequest("surahNumber (1-114) and ayahNumber are required");
  }

  const progress = await ReadingProgress.findOneAndUpdate(
    { user: req.user.id },
    { lastSurahNumber: surahNumber, lastAyahNumber: ayahNumber, lastReadAt: new Date() },
    { new: true, upsert: true }
  );

  await recordActivity(req.user.id, resolveDate(date));
  return sendSuccess(res, { message: "Progress updated", data: { progress } });
});

// POST /api/progress/complete  { type: "surah" | "juz", number, completed: true|false, date? }
const setCompleted = asyncHandler(async (req, res) => {
  const { type, number, completed, date } = req.body;

  const field = type === "surah" ? "surahsCompleted" : type === "juz" ? "juzCompleted" : null;
  if (!field) throw badRequest("type must be 'surah' or 'juz'");
  if (!isInt(number, 1, type === "surah" ? 114 : 30)) throw badRequest(`Invalid ${type} number`);
  if (typeof completed !== "boolean") throw badRequest("completed must be true or false");

  await ReadingProgress.findOneAndUpdate(
    { user: req.user.id },
    completed ? { $addToSet: { [field]: number } } : { $pull: { [field]: number } },
    { upsert: true }
  );

  const today = resolveDate(date);
  if (completed) await recordActivity(req.user.id, today);

  const stats = await buildStats(req.user.id, today);
  return sendSuccess(res, { message: completed ? "Marked as completed" : "Completion removed", data: { stats } });
});

// POST /api/progress/reset  { date? }  -> start a new Khatm (counts the old one if it was finished)
const resetProgress = asyncHandler(async (req, res) => {
  const today = resolveDate(req.body?.date);
  const before = await buildStats(req.user.id, today);

  const update = { $set: { surahsCompleted: [], juzCompleted: [] } };
  if (before.khatmPercent >= 100) update.$inc = { khatmCount: 1 };

  await ReadingProgress.findOneAndUpdate({ user: req.user.id }, update, { upsert: true });

  const stats = await buildStats(req.user.id, today);
  return sendSuccess(res, { message: "Progress reset", data: { stats } });
});

module.exports = { getMyProgress, getMyStats, updateMyProgress, setCompleted, resetProgress, buildStats };
