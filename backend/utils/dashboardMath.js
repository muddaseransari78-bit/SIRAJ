// Pure helper functions for the user dashboard (no database) - easy to unit-test.
// All dates are plain "YYYY-MM-DD" strings (the user's local day).

const { addDays } = require("./progressMath");

const BOOKMARK_TYPES = ["AYAH", "SURAH", "HADITH", "DUA"];
const PRAYERS = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];

/** [{ _id: "AYAH", count: 4 }, ...]  ->  { AYAH: 4, SURAH: 0, HADITH: 0, DUA: 0, total: 4 } */
function countByType(rows = []) {
  const out = { total: 0 };
  BOOKMARK_TYPES.forEach((t) => { out[t] = 0; });
  rows.forEach((r) => {
    if (BOOKMARK_TYPES.includes(r._id)) {
      out[r._id] = r.count;
      out.total += r.count;
    }
  });
  return out;
}

/** The n days that end on `today`, oldest first. */
function dayRange(today, n) {
  const days = [];
  for (let i = n - 1; i >= 0; i--) days.push(addDays(today, -i));
  return days;
}

/** rows: [{ _id: "2026-10-01", count: 3 }]  ->  [{ date, count }] for every day (missing days = 0). */
function fillDays(today, n, rows = []) {
  const byDate = {};
  rows.forEach((r) => { byDate[r._id] = r.count; });
  return dayRange(today, n).map((date) => ({ date, count: byDate[date] || 0 }));
}

/** logs: [{ date, prayer }] (completed ones only) -> one entry per day with a per-prayer map. */
function prayerDays(today, n, logs = []) {
  const byDate = {};
  logs.forEach((l) => {
    if (!PRAYERS.includes(l.prayer)) return;
    if (!byDate[l.date]) byDate[l.date] = {};
    byDate[l.date][l.prayer] = true;
  });
  return dayRange(today, n).map((date) => {
    const done = {};
    PRAYERS.forEach((p) => { done[p] = !!(byDate[date] && byDate[date][p]); });
    return { date, done, count: PRAYERS.filter((p) => done[p]).length };
  });
}

/** How many times each prayer was logged in the period -> { Fajr: 12, Dhuhr: 10, ... } */
function perPrayerTotals(days) {
  const totals = {};
  PRAYERS.forEach((p) => { totals[p] = days.filter((d) => d.done[p]).length; });
  return totals;
}

/**
 * Days in a row with all 5 prayers logged. Counts back from today if today is already complete,
 * otherwise from yesterday (today may still be in progress).
 */
function fullDayStreak(days) {
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    const isToday = i === days.length - 1;
    if (days[i].count === PRAYERS.length) streak += 1;
    else if (isToday) continue;
    else break;
  }
  return streak;
}

/** Clamp a user-supplied "days" query value to a safe whole number. */
function clampDays(value, fallback, max) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) return fallback;
  return Math.min(n, max);
}

module.exports = { BOOKMARK_TYPES, PRAYERS, countByType, dayRange, fillDays, prayerDays, perPrayerTotals, fullDayStreak, clampDays };
