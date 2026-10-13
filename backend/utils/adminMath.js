// Pure helpers for the admin portal (no database, no Express) - easy to unit-test.
const httpError = require("./httpError");
const { addDays, dayDiff, isValidDateString } = require("./progressMath");

const MAX_REPORT_DAYS = 92;

/** n dates ending on `today`, oldest first. */
function dayList(today, n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(addDays(today, -i));
  return out;
}

/** Every date from `from` to `to` (inclusive). */
function dateRange(from, to) {
  const n = dayDiff(to, from) + 1;
  return Array.from({ length: n }, (_, i) => addDays(from, i));
}

/** Validates ?from=&to= for reports. Defaults: the last 30 days ending today. Max 92 days. */
function parseRange(query, today) {
  const to = query.to === undefined || query.to === "" ? today : query.to;
  const from = query.from === undefined || query.from === "" ? addDays(to, -29) : query.from;
  if (!isValidDateString(from) || !isValidDateString(to)) throw httpError(400, "from and to must be real dates (YYYY-MM-DD)");
  if (dayDiff(to, from) < 0) throw httpError(400, "The start date must not be after the end date");
  if (dayDiff(to, from) + 1 > MAX_REPORT_DAYS) throw httpError(400, `A report can cover at most ${MAX_REPORT_DAYS} days`);
  return { from, to };
}

/** [{ _id: "2026-10-01", n: 3 }] -> { "2026-10-01": 3 } */
function toMap(rows = [], field = "n") {
  const m = {};
  rows.forEach((r) => { m[r._id] = r[field] || 0; });
  return m;
}

/**
 * pairs: [{ date, user }] = "this user was active on this date" (collected from reading, Tasbeeh and prayer data).
 * Returns distinct active users for today / the last 7 days / the whole window, plus a per-day series.
 */
function buildActiveStats(pairs, today, windowDays = 30) {
  const byDate = {};
  pairs.forEach((p) => {
    if (!byDate[p.date]) byDate[p.date] = new Set();
    byDate[p.date].add(String(p.user));
  });
  const days = dayList(today, windowDays);
  const union = (list) => {
    const all = new Set();
    list.forEach((d) => (byDate[d] ? byDate[d].forEach((u) => all.add(u)) : null));
    return all.size;
  };
  return {
    today: byDate[today] ? byDate[today].size : 0,
    last7: union(days.slice(-7)),
    window: union(days),
    daily: days.map((date) => ({ date, count: byDate[date] ? byDate[date].size : 0 })),
  };
}

/** One row per day for the reports table. Each map is { date: number }. */
function buildReportRows(days, m) {
  return days.map((date) => ({
    date,
    signups: (m.signups && m.signups[date]) || 0,
    activeUsers: (m.activeUsers && m.activeUsers[date]) || 0,
    readingActions: (m.readingActions && m.readingActions[date]) || 0,
    tasbeehSessions: (m.tasbeehSessions && m.tasbeehSessions[date]) || 0,
    tasbeehCount: (m.tasbeehCount && m.tasbeehCount[date]) || 0,
    prayersLogged: (m.prayersLogged && m.prayersLogged[date]) || 0,
  }));
}

const SUM_FIELDS = ["signups", "readingActions", "tasbeehSessions", "tasbeehCount", "prayersLogged"];
function sumRows(rows) {
  const totals = {};
  SUM_FIELDS.forEach((f) => { totals[f] = rows.reduce((s, r) => s + r[f], 0); });
  return totals;
}

/** Simple traffic light for the dashboard "System health" card. */
function healthLevel({ dbOk, errors24h }) {
  if (!dbOk) return { level: "problem", label: "Database offline" };
  if (errors24h > 0) return { level: "check", label: `${errors24h} server error${errors24h === 1 ? "" : "s"} in 24 hours` };
  return { level: "ok", label: "Healthy" };
}

function percentile(sortedAsc, p) {
  if (!sortedAsc.length) return 0;
  const idx = Math.min(sortedAsc.length - 1, Math.max(0, Math.ceil((p / 100) * sortedAsc.length) - 1));
  return sortedAsc[idx];
}

/** samples: [{ ms, status }] -> basic performance numbers. */
function summarizeRequests(samples) {
  if (!samples.length) return { count: 0, avgMs: 0, p95Ms: 0, serverErrors: 0, errorRatePercent: 0 };
  const times = samples.map((s) => s.ms).sort((a, b) => a - b);
  const serverErrors = samples.filter((s) => s.status >= 500).length;
  return {
    count: samples.length,
    avgMs: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
    p95Ms: Math.round(percentile(times, 95)),
    serverErrors,
    errorRatePercent: Math.round((serverErrors / samples.length) * 1000) / 10,
  };
}

/** Checks and cleans the body of PUT /admin/settings. Only known keys are accepted. */
function parseSettingsPatch(body) {
  const patch = {};
  const b = body || {};
  ["registrationEnabled", "ramadanEnabled"].forEach((k) => {
    if (b[k] !== undefined) {
      if (typeof b[k] !== "boolean") throw httpError(400, `${k} must be true or false`);
      patch[k] = b[k];
    }
  });
  if (b.siteNotice !== undefined) {
    if (typeof b.siteNotice !== "string") throw httpError(400, "siteNotice must be text");
    const text = b.siteNotice.trim();
    if (text.length > 200) throw httpError(400, "The site notice can be at most 200 characters");
    patch.siteNotice = text;
  }
  if (Object.keys(patch).length === 0) throw httpError(400, "Nothing to update");
  return patch;
}

module.exports = {
  MAX_REPORT_DAYS, dayList, dateRange, parseRange, toMap, buildActiveStats, buildReportRows, sumRows,
  healthLevel, percentile, summarizeRequests, parseSettingsPatch,
};
