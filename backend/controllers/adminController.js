const axios = require("axios");
const mongoose = require("mongoose");
const User = require("../models/User");
const Bookmark = require("../models/Bookmark");
const Note = require("../models/Note");
const TasbeehSession = require("../models/TasbeehSession");
const PrayerLog = require("../models/PrayerLog");
const ReadingActivity = require("../models/ReadingActivity");
const ReadingProgress = require("../models/ReadingProgress");
const Goal = require("../models/Goal");
const Notification = require("../models/Notification");
const ErrorLog = require("../models/ErrorLog");
const AuditLog = require("../models/AuditLog");
const Dua = require("../models/Dua");
const asyncHandler = require("../utils/asyncHandler");
const httpError = require("../utils/httpError");
const { sendSuccess } = require("../utils/apiResponse");
const { resolveDate, addDays } = require("../utils/progressMath");
const {
  dayList, dateRange, parseRange, toMap, buildActiveStats, buildReportRows, sumRows,
  healthLevel, summarizeRequests, parseSettingsPatch,
} = require("../utils/adminMath");
const { countByType } = require("../utils/dashboardMath");
const metrics = require("../utils/metrics");
const cache = require("../utils/cache");
const audit = require("../utils/audit");
const { getSettings, updateSettings } = require("../services/settingsService");
const tafsirApi = require("../services/external/tafsirApi");
const pronunciation = require("../services/pronunciationService");

const startOfDayUtc = (dateStr) => new Date(`${dateStr}T00:00:00Z`);

// ---------- shared queries ----------

// "User X was active on date D" pairs from reading, Tasbeeh and prayer data (dates are the users' local days).
async function activePairs(from, to) {
  const match = { date: { $gte: from, $lte: to } };
  const grp = { $group: { _id: { date: "$date", user: "$user" } } };
  const [a, b, c] = await Promise.all([
    ReadingActivity.aggregate([{ $match: match }, grp]),
    TasbeehSession.aggregate([{ $match: match }, grp]),
    PrayerLog.aggregate([{ $match: { ...match, completed: true } }, grp]),
  ]);
  return [...a, ...b, ...c].map((r) => ({ date: r._id.date, user: r._id.user }));
}

const sumByDate = (Model, match, field) =>
  Model.aggregate([{ $match: match }, { $group: { _id: "$date", n: { $sum: field ? `$${field}` : 1 } } }]);

const signupsByDay = (from, to) =>
  User.aggregate([
    { $match: { createdAt: { $gte: startOfDayUtc(from), $lt: startOfDayUtc(addDays(to, 1)) } } },
    { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, n: { $sum: 1 } } },
  ]);

// ---------- GET /api/admin/overview ----------
const overview = asyncHandler(async (req, res) => {
  const today = resolveDate(req.query.today);
  const WINDOW = 30;
  const days14 = dayList(today, 14);
  const since30 = addDays(today, -(WINDOW - 1));
  const since14 = days14[0];
  const dayMatch14 = { date: { $gte: since14, $lte: today } };
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
  const dayAgo = new Date(Date.now() - 86400000);

  const [
    totalUsers, activeAccounts, newUsers7d, signupRows, pairs, readingRows, tasbeehSessionRows,
    tasbeehTotals, bookmarkRows, notes, readers, prayers30d, readingActions30d, errors24h,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ isActive: true }),
    User.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
    signupsByDay(since14, today),
    activePairs(since30, today),
    sumByDate(ReadingActivity, dayMatch14, "count"),
    sumByDate(TasbeehSession, dayMatch14, null),
    TasbeehSession.aggregate([{ $group: { _id: null, sessions: { $sum: 1 }, count: { $sum: "$count" } } }]),
    Bookmark.aggregate([{ $group: { _id: "$type", count: { $sum: 1 } } }]),
    Note.countDocuments(),
    ReadingProgress.countDocuments({ lastReadAt: { $ne: null } }),
    PrayerLog.countDocuments({ completed: true, date: { $gte: since30, $lte: today } }),
    ReadingActivity.aggregate([{ $match: { date: { $gte: since30, $lte: today } } }, { $group: { _id: null, n: { $sum: "$count" } } }]),
    ErrorLog.countDocuments({ createdAt: { $gte: dayAgo } }),
  ]);

  const active = buildActiveStats(pairs, today, WINDOW);
  const signups = toMap(signupRows);
  const reading = toMap(readingRows);
  const sessions = toMap(tasbeehSessionRows);
  const dbOk = mongoose.connection.readyState === 1;

  return sendSuccess(res, {
    message: "Admin overview",
    data: {
      today,
      users: { total: totalUsers, activeAccounts, deactivated: totalUsers - activeAccounts, new7d: newUsers7d },
      activity: { activeToday: active.today, active7d: active.last7, active30d: active.window },
      quran: { readers, readingActions30d: readingActions30d[0] ? readingActions30d[0].n : 0 },
      tasbeeh: { sessions: tasbeehTotals[0] ? tasbeehTotals[0].sessions : 0, totalCount: tasbeehTotals[0] ? tasbeehTotals[0].count : 0 },
      bookmarks: countByType(bookmarkRows),
      notes,
      prayersLogged30d: prayers30d,
      daily: days14.map((date, i) => ({
        date,
        signups: signups[date] || 0,
        activeUsers: active.daily[active.daily.length - 14 + i].count,
        readingActions: reading[date] || 0,
        tasbeehSessions: sessions[date] || 0,
      })),
      health: { ...healthLevel({ dbOk, errors24h }), dbOk, errors24h },
    },
  });
});

// ---------- GET /api/admin/users/:id ----------
// Counts only. Notes, bookmarks and other private content of a user are never shown to admins.
const userDetail = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw httpError(404, "User not found");
  const user = await User.findById(req.params.id).lean();
  if (!user) throw httpError(404, "User not found");
  const id = user._id;

  const [bookmarkRows, notes, tasbeeh, progress, readingDays, lastReading, prayers, lastPrayer, lastTasbeeh, goals] = await Promise.all([
    Bookmark.aggregate([{ $match: { user: id } }, { $group: { _id: "$type", count: { $sum: 1 } } }]),
    Note.countDocuments({ user: id }),
    TasbeehSession.aggregate([{ $match: { user: id } }, { $group: { _id: null, sessions: { $sum: 1 }, count: { $sum: "$count" } } }]),
    ReadingProgress.findOne({ user: id }).lean(),
    ReadingActivity.countDocuments({ user: id }),
    ReadingActivity.findOne({ user: id }).sort({ date: -1 }).select("date").lean(),
    PrayerLog.countDocuments({ user: id, completed: true }),
    PrayerLog.findOne({ user: id, completed: true }).sort({ date: -1 }).select("date").lean(),
    TasbeehSession.findOne({ user: id }).sort({ date: -1 }).select("date").lean(),
    Goal.countDocuments({ user: id }),
  ]);

  const dates = [lastReading && lastReading.date, lastPrayer && lastPrayer.date, lastTasbeeh && lastTasbeeh.date].filter(Boolean).sort();

  return sendSuccess(res, {
    message: "User details",
    data: {
      user: { _id: user._id, name: user.name, email: user.email, role: user.role, isActive: user.isActive, createdAt: user.createdAt },
      stats: {
        bookmarks: countByType(bookmarkRows),
        notes,
        tasbeehSessions: tasbeeh[0] ? tasbeeh[0].sessions : 0,
        tasbeehCount: tasbeeh[0] ? tasbeeh[0].count : 0,
        surahsCompleted: progress ? progress.surahsCompleted.length : 0,
        juzCompleted: progress ? progress.juzCompleted.length : 0,
        khatmCount: progress ? progress.khatmCount : 0,
        lastRead: progress && progress.lastReadAt ? { surah: progress.lastSurahNumber, ayah: progress.lastAyahNumber, at: progress.lastReadAt } : null,
        readingDays,
        prayersLogged: prayers,
        goals,
        lastActiveDate: dates.length ? dates[dates.length - 1] : null,
      },
    },
  });
});

// ---------- GET /api/admin/sources  (Quran / Hadith / Tafseer: read-only provenance) ----------
const host = (url, fallback) => {
  try { return new URL(process.env[url] || fallback).host; } catch (e) { return fallback; }
};

const sources = asyncHandler(async (req, res) => {
  const [quranBookmarks, hadithBookmarks, notes, tafsirList] = await Promise.all([
    Bookmark.countDocuments({ type: { $in: ["AYAH", "SURAH"] } }),
    Bookmark.countDocuments({ type: "HADITH" }),
    Note.countDocuments(),
    tafsirApi.getTafsirSources().catch(() => []),
  ]);
  const quranHost = host("QURAN_API_BASE_URL", "https://api.alquran.cloud/v1");
  const islamicHost = host("ISLAMIC_API_BASE_URL", "https://api.islamic.app");

  return sendSuccess(res, {
    message: "Content sources",
    data: {
      quran: {
        provider: quranHost,
        layers: [
          { name: "Arabic text", source: "AlQuran Cloud edition quran-uthmani" },
          { name: "Tajweed colours", source: "AlQuran Cloud edition quran-tajweed" },
          { name: "English translations", source: "en.sahih, en.asad, en.pickthall, en.yusufali (AlQuran Cloud)" },
          { name: "Urdu translation", source: "ur.jalandhry — Fateh Muhammad Jalandhry (AlQuran Cloud)" },
          { name: "Transliteration", source: "en.transliteration (AlQuran Cloud)" },
        ],
        userData: [{ label: "Saved Surahs / Ayahs", value: quranBookmarks }, { label: "Ayah notes", value: notes }],
      },
      hadith: {
        provider: islamicHost,
        layers: [{ name: "Hadith collections, books and search", source: `Fetched live from ${islamicHost}; every Hadith shows its collection, book and number` }],
        userData: [{ label: "Saved Hadith", value: hadithBookmarks }],
      },
      tafseer: {
        provider: islamicHost,
        layers: [{ name: "Tafseer", source: `Fetched live from ${islamicHost}; the Tafseer name is shown with every text` }],
        sources: tafsirList.map((t) => ({ slug: t.slug, name: t.name, language: t.language })),
        userData: [],
      },
      cache: cacheStats(),
    },
  });
});

function cacheStats() {
  const s = cache.getStats();
  return { keys: s.keys, hits: s.hits, misses: s.misses };
}

const clearCache = asyncHandler(async (req, res) => {
  cache.flushAll();
  audit(req, "CACHE_CLEAR", "content cache");
  return sendSuccess(res, { message: "Content cache cleared. Fresh data will be fetched on the next visit." });
});

// ---------- GET /api/admin/dua-categories ----------
const duaCategories = asyncHandler(async (req, res) => {
  const rows = await Dua.aggregate([
    { $group: { _id: "$category", total: { $sum: 1 }, visible: { $sum: { $cond: ["$isActive", 1, 0] } } } },
    { $sort: { _id: 1 } },
  ]);
  return sendSuccess(res, { message: "Dua categories", data: { categories: rows.map((r) => ({ category: r._id, total: r.total, visible: r.visible })) } });
});

// ---------- settings ----------
const getAdminSettings = asyncHandler(async (req, res) => {
  return sendSuccess(res, { message: "Settings", data: { settings: await getSettings() } });
});

const putAdminSettings = asyncHandler(async (req, res) => {
  const patch = parseSettingsPatch(req.body);
  const settings = await updateSettings(patch, req.user.id);
  const detail = Object.keys(patch).map((k) => (k === "siteNotice" ? "siteNotice changed" : `${k}=${patch[k]}`)).join(", ");
  audit(req, "SETTINGS_UPDATE", "website settings", detail);
  return sendSuccess(res, { message: "Settings saved", data: { settings } });
});

// ---------- GET /api/admin/reports?from=&to= ----------
const reports = asyncHandler(async (req, res) => {
  const today = resolveDate(req.query.today);
  const { from, to } = parseRange(req.query, today);
  const days = dateRange(from, to);
  const match = { date: { $gte: from, $lte: to } };

  const [signupRows, pairs, readingRows, sessionRows, countRows, prayerRows, bookmarkRows, newNotes] = await Promise.all([
    signupsByDay(from, to),
    activePairs(from, to),
    sumByDate(ReadingActivity, match, "count"),
    sumByDate(TasbeehSession, match, null),
    sumByDate(TasbeehSession, match, "count"),
    sumByDate(PrayerLog, { ...match, completed: true }, null),
    Bookmark.aggregate([
      { $match: { createdAt: { $gte: startOfDayUtc(from), $lt: startOfDayUtc(addDays(to, 1)) } } },
      { $group: { _id: "$type", count: { $sum: 1 } } },
    ]),
    Note.countDocuments({ createdAt: { $gte: startOfDayUtc(from), $lt: startOfDayUtc(addDays(to, 1)) } }),
  ]);

  const active = buildActiveStats(pairs, to, days.length);
  const rows = buildReportRows(days, {
    signups: toMap(signupRows),
    activeUsers: Object.fromEntries(active.daily.map((d) => [d.date, d.count])),
    readingActions: toMap(readingRows),
    tasbeehSessions: toMap(sessionRows),
    tasbeehCount: toMap(countRows),
    prayersLogged: toMap(prayerRows),
  });

  return sendSuccess(res, {
    message: "Report",
    data: {
      from, to, rows,
      totals: { ...sumRows(rows), distinctActiveUsers: active.window },
      newBookmarks: countByType(bookmarkRows),
      newNotes,
    },
  });
});

// ---------- GET /api/admin/audit-log ----------
const auditLog = asyncHandler(async (req, res) => {
  const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(100).lean();
  return sendSuccess(res, { message: "Audit log", data: { logs } });
});

// ---------- notification broadcast history (from the audit log) ----------
const broadcastHistory = asyncHandler(async (req, res) => {
  const logs = await AuditLog.find({ action: "BROADCAST" }).sort({ createdAt: -1 }).limit(20).lean();
  return sendSuccess(res, { message: "Broadcast history", data: { logs } });
});

// ---------- status checks ----------
async function ping(name, group, url, { headers } = {}) {
  const start = Date.now();
  try {
    const r = await axios.get(url, { timeout: 8000, headers });
    return { name, group, ok: true, ms: Date.now() - start, status: r.status };
  } catch (e) {
    return { name, group, ok: false, ms: Date.now() - start, status: e.response ? e.response.status : null };
  }
}

const apiStatus = asyncHandler(async (req, res) => {
  const quranBase = process.env.QURAN_API_BASE_URL || "https://api.alquran.cloud/v1";
  const prayerBase = process.env.PRAYER_API_BASE_URL || "https://api.aladhan.com/v1";
  const islamicBase = process.env.ISLAMIC_API_BASE_URL || "https://api.islamic.app";
  const geoBase = process.env.GEOCODE_API_BASE_URL || "https://geocoding-api.open-meteo.com/v1";

  const checks = [
    ping("Quran API (AlQuran Cloud)", "Quran", `${quranBase}/surah/1`),
    ping("Hadith / Duas / Qibla / Tafseer API (islamic.app)", "Hadith & Tafseer", `${islamicBase}/health`),
    ping("Prayer & Hijri API (AlAdhan)", "Prayer", `${prayerBase}/timings?latitude=21.42&longitude=39.82&method=3`),
    ping("City search (Open-Meteo)", "Location", `${geoBase}/search?name=Makkah&count=1`),
  ];
  const pronConfigured = pronunciation.isConfigured();
  if (pronConfigured) {
    checks.push(ping("Recitation service (zabar / zer / pesh)", "Recitation", `${process.env.PRONUNCIATION_API_URL.replace(/\/+$/, "")}/health`));
  }
  const services = await Promise.all(checks);

  return sendSuccess(res, {
    message: "API status",
    data: {
      services,
      notConfigured: pronConfigured ? [] : ["Recitation service (PRONUNCIATION_API_URL is empty)"],
      checkedAt: new Date().toISOString(),
    },
  });
});

const systemStatus = asyncHandler(async (req, res) => {
  const dbStates = ["disconnected", "connected", "connecting", "disconnecting"];
  const dayAgo = new Date(Date.now() - 86400000);
  const [errors24h, notifications24h] = await Promise.all([
    ErrorLog.countDocuments({ createdAt: { $gte: dayAgo } }),
    Notification.countDocuments({ createdAt: { $gte: dayAgo } }),
  ]);
  const snap = metrics.snapshot();
  const mem = process.memoryUsage();

  return sendSuccess(res, {
    message: "System status",
    data: {
      backend: { ok: true, uptimeSeconds: Math.round(process.uptime()), node: process.version, env: process.env.NODE_ENV || "development" },
      database: { state: dbStates[mongoose.connection.readyState] || "unknown", ok: mongoose.connection.readyState === 1 },
      notifications: {
        inApp: { ok: mongoose.connection.readyState === 1, last24h: notifications24h },
        browserReminders: "Run inside each user's browser tab while SIRAJ is open",
        webPush: require("../services/pushService").pushEnabled()
          ? "On: the server sends prayer / Jamaat reminders even when SIRAJ is closed (checks every 30 seconds)"
          : "Not set up yet (add VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY to .env: npm run vapid)",
      },
      performance: {
        ...summarizeRequests(snap.samples),
        windowRequests: snap.samples.length,
        totalSinceStart: snap.totalSinceStart,
        memoryMB: Math.round(mem.rss / 1048576),
        heapUsedMB: Math.round(mem.heapUsed / 1048576),
      },
      cache: cacheStats(),
      errors24h,
    },
  });
});

module.exports = {
  overview, userDetail, sources, clearCache, duaCategories, getAdminSettings, putAdminSettings,
  reports, auditLog, broadcastHistory, apiStatus, systemStatus,
};
