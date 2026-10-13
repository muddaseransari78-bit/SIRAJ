// Tasbeeh validation helpers (pure functions, no database) so they can be unit-tested.
const httpError = require("./httpError");

const MAX_COUNT = 1000000;       // one saved session
const MAX_TARGET = 100000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/** "YYYY-MM-DD" must be a real calendar day */
function isRealDate(str) {
  if (!DATE_RE.test(str)) return false;
  const [y, m, d] = str.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/**
 * The browser sends its own local date (so "today" is right in every time zone).
 * We only accept dates within 2 days of the server date, to stop nonsense/spoofed dates.
 */
function readLocalDate(value, nowMs = Date.now()) {
  if (value === undefined || value === null || value === "") return new Date(nowMs).toISOString().slice(0, 10);
  const str = String(value);
  if (!isRealDate(str)) throw httpError(400, "date must be YYYY-MM-DD");
  const diff = Math.abs(new Date(`${str}T00:00:00Z`).getTime() - new Date(new Date(nowMs).toISOString().slice(0, 10) + "T00:00:00Z").getTime());
  if (diff > 2 * DAY_MS) throw httpError(400, "date is too far from the server date");
  return str;
}

/** Validates the body of POST /tasbeeh/sessions and returns clean values. */
function parseSession(body, nowMs = Date.now()) {
  const b = body || {};
  const dhikr = typeof b.dhikr === "string" ? b.dhikr.trim() : "";
  if (!dhikr || dhikr.length > 100) throw httpError(400, "dhikr is required (max 100 characters)");
  const count = b.count;
  if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT) throw httpError(400, `count must be a whole number from 1 to ${MAX_COUNT}`);
  let target = 33;
  if (b.target !== undefined && b.target !== null) {
    if (!Number.isInteger(b.target) || b.target < 1 || b.target > MAX_TARGET) throw httpError(400, `target must be a whole number from 1 to ${MAX_TARGET}`);
    target = b.target;
  }
  return { dhikr, count, target, date: readLocalDate(b.date, nowMs) };
}

/** [today-6 ... today] as YYYY-MM-DD, for the 7-day chart */
function lastDays(today, n = 7) {
  const [y, m, d] = today.split("-").map(Number);
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(new Date(Date.UTC(y, m - 1, d - i)).toISOString().slice(0, 10));
  return out;
}

module.exports = { parseSession, readLocalDate, lastDays, isRealDate, MAX_COUNT, MAX_TARGET };
