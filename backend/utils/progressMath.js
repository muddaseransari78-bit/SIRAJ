// Pure helper functions for reading progress (no database) - easy to test.
// All dates are plain "YYYY-MM-DD" strings.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86400000;

function utcToday() {
  return new Date().toISOString().slice(0, 10);
}

function isValidDateString(value) {
  if (typeof value !== "string" || !DATE_RE.test(value)) return false;
  const d = new Date(value + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function dayDiff(a, b) {
  return Math.round((Date.parse(a + "T00:00:00Z") - Date.parse(b + "T00:00:00Z")) / DAY_MS);
}

function addDays(dateStr, days) {
  return new Date(Date.parse(dateStr + "T00:00:00Z") + days * DAY_MS).toISOString().slice(0, 10);
}

/**
 * The browser sends its LOCAL date (so a user in Pakistan gets the right "today").
 * We accept it only if it is within 1 day of the server's UTC date - this covers every
 * time zone but stops people from faking a long streak with made-up dates.
 */
function resolveDate(input, now = utcToday()) {
  if (isValidDateString(input) && Math.abs(dayDiff(input, now)) <= 1) return input;
  return now;
}

/**
 * dates: array of "YYYY-MM-DD" strings on which the user was active.
 * Current streak = consecutive active days ending today (or yesterday, if today has no activity yet).
 */
function computeStreaks(dates, today) {
  const set = new Set(dates);

  let current = 0;
  let cursor = set.has(today) ? today : addDays(today, -1);
  while (set.has(cursor)) {
    current += 1;
    cursor = addDays(cursor, -1);
  }

  const sorted = [...set].sort();
  let longest = 0;
  let run = 0;
  let prev = null;
  for (const d of sorted) {
    run = prev && dayDiff(d, prev) === 1 ? run + 1 : 1;
    if (run > longest) longest = run;
    prev = d;
  }

  return { current, longest };
}

function lastNDays(today, n, activeSet) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const date = addDays(today, -i);
    out.push({ date, active: activeSet.has(date) });
  }
  return out;
}

/**
 * Khatm progress. Surahs are weighted by their number of ayahs when we know them
 * (surahMeta = [{ number, numberOfAyahs }]), otherwise counted as 1/114 each.
 * Juz are counted as 1/30 each. The headline number is the higher of the two.
 */
function computeProgress({ surahsCompleted = [], juzCompleted = [], surahMeta = null }) {
  const doneSurahs = [...new Set(surahsCompleted)].filter((n) => n >= 1 && n <= 114);
  const doneJuz = [...new Set(juzCompleted)].filter((n) => n >= 1 && n <= 30);

  let surahPercent = (doneSurahs.length / 114) * 100;
  let ayahsRead = null;
  let totalAyahs = null;

  if (surahMeta && surahMeta.length === 114) {
    totalAyahs = surahMeta.reduce((sum, s) => sum + s.numberOfAyahs, 0);
    ayahsRead = surahMeta.filter((s) => doneSurahs.includes(s.number)).reduce((sum, s) => sum + s.numberOfAyahs, 0);
    surahPercent = (ayahsRead / totalAyahs) * 100;
  }

  const juzPercent = (doneJuz.length / 30) * 100;
  const khatmPercent = Math.round(Math.max(surahPercent, juzPercent));

  return {
    surahsDone: doneSurahs.length,
    juzDone: doneJuz.length,
    surahPercent: Math.round(surahPercent),
    juzPercent: Math.round(juzPercent),
    khatmPercent,
    ayahsRead,
    totalAyahs,
  };
}

module.exports = { utcToday, isValidDateString, dayDiff, addDays, resolveDate, computeStreaks, lastNDays, computeProgress };
