const mongoose = require("mongoose");
const Bookmark = require("../models/Bookmark");
const Note = require("../models/Note");
const Notification = require("../models/Notification");
const TasbeehSession = require("../models/TasbeehSession");
const PrayerLog = require("../models/PrayerLog");
const PrayerSettings = require("../models/PrayerSettings");
const ReadingActivity = require("../models/ReadingActivity");
const ReadingProgress = require("../models/ReadingProgress");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const { resolveDate, addDays, computeStreaks } = require("../utils/progressMath");
const {
  countByType, fillDays, prayerDays, perPrayerTotals, fullDayStreak, clampDays,
} = require("../utils/dashboardMath");
const { buildStats } = require("./progressController");
const { goalItems } = require("./goalController");

const oid = (id) => new mongoose.Types.ObjectId(id);

// The browser sends tz = Date.getTimezoneOffset() (minutes). Goals need it to find "today" for Tasbeeh.
function readTz(query) {
  const tz = Number(query.tz || 0);
  return Number.isFinite(tz) && Math.abs(tz) <= 900 ? tz : 0;
}

// GET /api/dashboard/summary?today=YYYY-MM-DD&tz=-300
// Everything the "My SIRAJ" overview needs in ONE request (instead of 8 separate ones).
const getSummary = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const today = resolveDate(req.query.today);
  const tz = readTz(req.query);
  const week = fillDays(today, 7, []).map((d) => d.date);

  const [
    bookmarkRows, notesCount, unreadCount, latestNotifications,
    stats, tasbeehWeek, tasbeehAll, prayerLogs, prayerSettings, goals,
  ] = await Promise.all([
    Bookmark.aggregate([{ $match: { user: oid(userId) } }, { $group: { _id: "$type", count: { $sum: 1 } } }]),
    Note.countDocuments({ user: userId }),
    Notification.countDocuments({ user: userId, read: false }),
    Notification.find({ user: userId }).sort({ createdAt: -1 }).limit(3).select("title body link read createdAt").lean(),
    buildStats(userId, today),
    TasbeehSession.aggregate([
      { $match: { user: oid(userId), date: { $in: week } } },
      { $group: { _id: "$date", count: { $sum: "$count" } } },
    ]),
    TasbeehSession.aggregate([
      { $match: { user: oid(userId) } },
      { $group: { _id: null, total: { $sum: "$count" }, sessions: { $sum: 1 } } },
    ]),
    PrayerLog.find({ user: userId, date: { $in: week }, completed: true }).select("date prayer -_id").lean(),
    PrayerSettings.findOne({ user: userId }).lean(),
    goalItems(userId, { today, tz }),
  ]);

  const tasbeeh7 = fillDays(today, 7, tasbeehWeek);
  const prayer7 = prayerDays(today, 7, prayerLogs);

  return sendSuccess(res, {
    message: "Dashboard summary",
    data: {
      today,
      bookmarks: countByType(bookmarkRows),
      notesCount,
      notifications: { unreadCount, latest: latestNotifications },
      quran: stats, // lastSurahNumber, lastAyahNumber, khatmPercent, surahsDone, juzDone, streak, last7 ...
      tasbeeh: {
        todayTotal: tasbeeh7[tasbeeh7.length - 1].count,
        last7: tasbeeh7,
        allTimeTotal: tasbeehAll[0] ? tasbeehAll[0].total : 0,
        allTimeSessions: tasbeehAll[0] ? tasbeehAll[0].sessions : 0,
      },
      prayer: {
        todayCount: prayer7[prayer7.length - 1].count,
        last7: prayer7.map((d) => ({ date: d.date, count: d.count })),
      },
      prayerSettings: prayerSettings
        ? {
            method: prayerSettings.method,
            school: prayerSettings.school,
            notificationsEnabled: prayerSettings.notificationsEnabled,
            adhanEnabled: prayerSettings.adhanEnabled,
            minutesBefore: prayerSettings.minutesBefore,
            city: prayerSettings.city,
            country: prayerSettings.country,
          }
        : null,
      goals,
    },
  });
});

// GET /api/dashboard/reading-history?today=...&days=84
// One entry per day: how many times the user used "mark last read" / marked a Surah or Juz complete.
// (We store active DAYS, not every single Ayah that was opened.)
const getReadingHistory = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const today = resolveDate(req.query.today);
  const days = clampDays(req.query.days, 84, 365);

  const since = addDays(today, -(days - 1));
  const [rows, allRows, progress] = await Promise.all([
    ReadingActivity.find({ user: userId, date: { $gte: since, $lte: today } }).select("date count -_id").lean(),
    ReadingActivity.find({ user: userId, date: { $gte: addDays(today, -400) } }).select("date -_id").lean(),
    ReadingProgress.findOne({ user: userId }).lean(),
  ]);

  const history = fillDays(today, days, rows.map((r) => ({ _id: r.date, count: r.count })));
  return sendSuccess(res, {
    message: "Reading history",
    data: {
      days: history,
      activeDays: history.filter((d) => d.count > 0).length,
      streak: computeStreaks(allRows.map((r) => r.date), today),
      lastSurahNumber: progress ? progress.lastSurahNumber : 1,
      lastAyahNumber: progress ? progress.lastAyahNumber : 1,
      lastReadAt: progress ? progress.lastReadAt : null,
    },
  });
});

// GET /api/dashboard/prayer-history?today=...&days=30
// Self-recorded prayers only. This is the user's own tracking, not a religious judgement.
const getPrayerHistory = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const today = resolveDate(req.query.today);
  const days = clampDays(req.query.days, 30, 90);

  const logs = await PrayerLog.find({
    user: userId, completed: true, date: { $gte: addDays(today, -(days - 1)), $lte: today },
  }).select("date prayer -_id").lean();

  const history = prayerDays(today, days, logs);
  return sendSuccess(res, {
    message: "Prayer history",
    data: {
      days: history,
      totalLogged: history.reduce((sum, d) => sum + d.count, 0),
      fullDays: history.filter((d) => d.count === 5).length,
      perPrayer: perPrayerTotals(history),
      streak: fullDayStreak(history),
    },
  });
});

module.exports = { getSummary, getReadingHistory, getPrayerHistory };
