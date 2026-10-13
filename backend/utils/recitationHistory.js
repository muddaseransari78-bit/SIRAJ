// Pure helpers for saved recitation practice sessions (no database) - easy to unit-test.
const httpError = require("./httpError");
const { isValidDateString, dayDiff, addDays } = require("./progressMath");

const MAX_AYAHS = 286;

const isWhole = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;

/** Checks and cleans the body of POST /recitation/sessions. Throws a 400 for anything odd. */
function parseSession(body, now = new Date().toISOString().slice(0, 10)) {
  const b = body || {};
  if (!isWhole(b.surahNumber, 1, 114)) throw httpError(400, "surahNumber must be a whole number from 1 to 114");
  if (!Array.isArray(b.ayahs) || b.ayahs.length < 1 || b.ayahs.length > MAX_AYAHS) {
    throw httpError(400, `ayahs must be a list of 1 to ${MAX_AYAHS} results`);
  }
  const seen = new Set();
  const ayahs = b.ayahs.map((a) => {
    if (!a || !isWhole(a.ayahNumber, 1, MAX_AYAHS) || !isWhole(a.score, 0, 100) || !isWhole(a.problems, 0, 400)) {
      throw httpError(400, "Each Ayah result needs a whole ayahNumber, score (0-100) and problems");
    }
    if (seen.has(a.ayahNumber)) throw httpError(400, "The same Ayah appears twice");
    seen.add(a.ayahNumber);
    return { ayahNumber: a.ayahNumber, score: a.score, problems: a.problems };
  });
  // The browser sends its local date. It must be real and within one day of the server's date (any time zone).
  let date = now;
  if (b.date !== undefined) {
    if (!isValidDateString(b.date) || Math.abs(dayDiff(b.date, now)) > 1) throw httpError(400, "date must be a real day close to today");
    date = b.date;
  }
  const averageScore = Math.round(ayahs.reduce((s, a) => s + a.score, 0) / ayahs.length);
  return { surahNumber: b.surahNumber, date, ayahs, averageScore };
}

/** sessions: [{ ayahs, averageScore, date }] -> totals for the history header. */
function summarize(sessions = []) {
  const ayahCount = sessions.reduce((s, x) => s + x.ayahs.length, 0);
  const weighted = sessions.reduce((s, x) => s + x.averageScore * x.ayahs.length, 0);
  return {
    sessions: sessions.length,
    ayahsPracticed: ayahCount,
    averageScore: ayahCount ? Math.round(weighted / ayahCount) : 0,
  };
}

/** One entry per day for the last n days (oldest first): { date, sessions, ayahs }. */
function perDay(sessions, today, n) {
  const map = {};
  sessions.forEach((s) => {
    if (!map[s.date]) map[s.date] = { sessions: 0, ayahs: 0 };
    map[s.date].sessions += 1;
    map[s.date].ayahs += s.ayahs.length;
  });
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const date = addDays(today, -i);
    out.push({ date, sessions: map[date] ? map[date].sessions : 0, ayahs: map[date] ? map[date].ayahs : 0 });
  }
  return out;
}

module.exports = { MAX_AYAHS, parseSession, summarize, perDay };
