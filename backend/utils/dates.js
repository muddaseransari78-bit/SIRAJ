// Small date helpers for the calendar and Ramadan features.
// All dates travel as "DD-MM-YYYY" (the format the AlAdhan API uses).
// Pure code (no packages) so it can be unit-tested without a server.

const DMY = /^(\d{2})-(\d{2})-(\d{4})$/;

/** "02-10-2026" -> { d: 2, m: 10, y: 2026 }, or null when it is not a real calendar day. */
function parseDMY(str) {
  const m = DMY.exec(String(str || ""));
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = Number(m[3]);
  const t = new Date(Date.UTC(y, mo - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d) return null;
  return { d, m: mo, y };
}

/**
 * Hijri dates are only checked for shape and range (1-30, 1-12, 1300-1700).
 * Whether day 30 exists in that month is decided by the calendar API.
 */
function parseHijriDMY(str) {
  const m = DMY.exec(String(str || ""));
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = Number(m[3]);
  if (d < 1 || d > 30 || mo < 1 || mo > 12 || y < 1300 || y > 1700) return null;
  return { d, m: mo, y };
}

const pad = (n) => String(n).padStart(2, "0");
const fromParts = (p) => `${pad(p.d)}-${pad(p.m)}-${p.y}`;
const utcMs = (p) => Date.UTC(p.y, p.m - 1, p.d);

/** Whole days from `fromDMY` to `toDMY` (negative when `toDMY` is earlier). null if either is invalid. */
function daysBetweenDMY(fromDMY, toDMY) {
  const a = parseDMY(fromDMY);
  const b = parseDMY(toDMY);
  if (!a || !b) return null;
  return Math.round((utcMs(b) - utcMs(a)) / 86400000);
}

/** Today's date (server clock, UTC) as DD-MM-YYYY - only a fallback when the browser sent no date. */
function todayDMY() {
  const d = new Date();
  return `${pad(d.getUTCDate())}-${pad(d.getUTCMonth() + 1)}-${d.getUTCFullYear()}`;
}

module.exports = { parseDMY, parseHijriDMY, daysBetweenDMY, todayDMY, fromParts };
