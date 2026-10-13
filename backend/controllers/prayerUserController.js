const PrayerSettings = require("../models/PrayerSettings");
const PrayerLog = require("../models/PrayerLog");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const { TIME_RE } = require("../utils/prayerSchedule");

const PRAYERS = PrayerSettings.PRAYERS;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function bad(message) {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
}

const getSettings = asyncHandler(async (req, res) => {
  let settings = await PrayerSettings.findOne({ user: req.user.id });
  if (!settings) settings = await PrayerSettings.create({ user: req.user.id });
  return sendSuccess(res, { message: "Prayer settings", data: { settings } });
});

// Pure validation: turns the request body into a safe $set object (or throws a 400).
function buildSettingsUpdate(body) {
  const {
    method, school, notificationsEnabled, adhanEnabled, minutesBefore, perPrayer, adhanPer, before, adjust, customMessage, city, country,
    jamaatEnabled, jamaatBefore, jamaatMode, jamaatTime, jamaatOffset,
  } = body || {};
  const update = {};
  if (method !== undefined) {
    if (!Number.isInteger(method) || method < 0 || method > 99) throw bad("Invalid calculation method");
    update.method = method;
  }
  if (school !== undefined) {
    if (school !== 0 && school !== 1) throw bad("school must be 0 (Shafi) or 1 (Hanafi)");
    update.school = school;
  }
  if (notificationsEnabled !== undefined) update.notificationsEnabled = !!notificationsEnabled;
  if (adhanEnabled !== undefined) update.adhanEnabled = !!adhanEnabled;
  if (minutesBefore !== undefined) {
    if (!Number.isInteger(minutesBefore) || minutesBefore < 0 || minutesBefore > 60) throw bad("minutesBefore must be 0-60");
    update.minutesBefore = minutesBefore;
  }
  const each = (obj, fn) => {
    if (obj && typeof obj === "object") PRAYERS.forEach((p) => { if (obj[p] !== undefined) fn(p, obj[p]); });
  };
  each(perPrayer, (p, v) => { update[`perPrayer.${p}`] = !!v; });
  each(adhanPer, (p, v) => { update[`adhanPer.${p}`] = !!v; });
  each(before, (p, v) => {
    if (v === null) { update[`before.${p}`] = null; return; } // null = "use the global value"
    if (!Number.isInteger(v) || v < 0 || v > 60) throw bad("before must be 0-60 minutes");
    update[`before.${p}`] = v;
  });
  each(adjust, (p, v) => {
    if (!Number.isInteger(v) || v < -30 || v > 30) throw bad("adjust must be whole minutes between -30 and 30");
    update[`adjust.${p}`] = v;
  });
  each(customMessage, (p, v) => {
    if (typeof v !== "string" || v.length > 120) throw bad("Custom message must be text up to 120 characters");
    update[`customMessage.${p}`] = v.trim();
  });
  // Phase 31 - Jamaat (congregation) times
  if (jamaatEnabled !== undefined) update.jamaatEnabled = !!jamaatEnabled;
  if (jamaatBefore !== undefined) {
    if (!Number.isInteger(jamaatBefore) || jamaatBefore < 0 || jamaatBefore > 60) throw bad("jamaatBefore must be 0-60");
    update.jamaatBefore = jamaatBefore;
  }
  each(jamaatMode, (p, v) => {
    if (!["off", "fixed", "offset"].includes(v)) throw bad("Jamaat mode must be off, fixed or offset");
    update[`jamaatMode.${p}`] = v;
  });
  each(jamaatTime, (p, v) => {
    if (v !== "" && !TIME_RE.test(String(v))) throw bad("Jamaat time must look like 13:30 (24-hour HH:MM)");
    update[`jamaatTime.${p}`] = v;
  });
  each(jamaatOffset, (p, v) => {
    if (!Number.isInteger(v) || v < 0 || v > 180) throw bad("Jamaat offset must be whole minutes between 0 and 180");
    update[`jamaatOffset.${p}`] = v;
  });
  if (city !== undefined) {
    if (typeof city !== "string" || city.length > 80) throw bad("Invalid city");
    update.city = city.trim();
  }
  if (country !== undefined) {
    if (typeof country !== "string" || country.length > 80) throw bad("Invalid country");
    update.country = country.trim();
  }
  return update;
}

const updateSettings = asyncHandler(async (req, res) => {
  const update = buildSettingsUpdate(req.body);
  const settings = await PrayerSettings.findOneAndUpdate(
    { user: req.user.id },
    { $set: update },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return sendSuccess(res, { message: "Settings saved", data: { settings } });
});

// Logs for one day (default today)
const getLogs = asyncHandler(async (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  if (!DATE_RE.test(date)) throw bad("date must be YYYY-MM-DD");
  const logs = await PrayerLog.find({ user: req.user.id, date });
  const done = {};
  logs.forEach((l) => { done[l.prayer] = l.completed; });
  return sendSuccess(res, { message: "Prayer log", data: { date, done } });
});

// Set completed true/false for a prayer on a date
const setLog = asyncHandler(async (req, res) => {
  const { prayer, completed = true } = req.body;
  const date = req.body.date || new Date().toISOString().slice(0, 10);
  if (!PRAYERS.includes(prayer)) throw bad("Invalid prayer name");
  if (!DATE_RE.test(date)) throw bad("date must be YYYY-MM-DD");
  const log = await PrayerLog.findOneAndUpdate(
    { user: req.user.id, date, prayer },
    { $set: { completed: !!completed } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return sendSuccess(res, { message: "Log updated", data: { log } });
});

// Last 7 days summary + current streak of days with all 5 prayers
const getStats = asyncHandler(async (req, res) => {
  // "today" comes from the browser (its local date) so the stats are right in every time zone
  const today = req.query.today || new Date().toISOString().slice(0, 10);
  if (!DATE_RE.test(today)) throw bad("today must be YYYY-MM-DD");
  const [y, m, d] = today.split("-").map(Number);
  const days = [];
  for (let i = 29; i >= 0; i--) {
    days.push(new Date(Date.UTC(y, m - 1, d - i)).toISOString().slice(0, 10));
  }
  const logs = await PrayerLog.find({ user: req.user.id, date: { $in: days }, completed: true });
  const counts = {};
  logs.forEach((l) => { counts[l.date] = (counts[l.date] || 0) + 1; });

  const daily = days.map((date) => ({ date, count: counts[date] || 0 }));

  // Streak: consecutive full days ending yesterday, plus today if already complete
  let streak = 0;
  for (let i = daily.length - 1; i >= 0; i--) {
    const isToday = i === daily.length - 1;
    if (daily[i].count === 5) streak++;
    else if (isToday) continue; // today may still be in progress
    else break;
  }

  return sendSuccess(res, {
    message: "Prayer stats",
    data: { last7: daily.slice(-7), streak, totalLast30: logs.length },
  });
});

module.exports = { getSettings, updateSettings, getLogs, setLog, getStats, buildSettingsUpdate };
