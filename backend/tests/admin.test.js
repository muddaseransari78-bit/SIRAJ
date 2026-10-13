const test = require("node:test");
const assert = require("node:assert");
const {
  dayList, dateRange, parseRange, toMap, buildActiveStats, buildReportRows, sumRows,
  healthLevel, percentile, summarizeRequests, parseSettingsPatch,
} = require("../utils/adminMath");

const code = (fn) => { try { fn(); return null; } catch (e) { return e.statusCode; } };

test("dayList and dateRange are oldest-first and cross month borders", () => {
  assert.deepStrictEqual(dayList("2026-10-02", 3), ["2026-09-30", "2026-10-01", "2026-10-02"]);
  assert.deepStrictEqual(dateRange("2026-09-29", "2026-10-01"), ["2026-09-29", "2026-09-30", "2026-10-01"]);
  assert.deepStrictEqual(dateRange("2026-10-01", "2026-10-01"), ["2026-10-01"]);
});

test("parseRange defaults to the last 30 days", () => {
  assert.deepStrictEqual(parseRange({}, "2026-10-30"), { from: "2026-10-01", to: "2026-10-30" });
  assert.deepStrictEqual(parseRange({ from: "2026-10-01", to: "2026-10-05" }, "2026-10-30"), { from: "2026-10-01", to: "2026-10-05" });
});

test("parseRange rejects bad, reversed and too long ranges", () => {
  assert.strictEqual(code(() => parseRange({ from: "2026-13-01", to: "2026-10-05" }, "2026-10-30")), 400);
  assert.strictEqual(code(() => parseRange({ from: "abc", to: "2026-10-05" }, "2026-10-30")), 400);
  assert.strictEqual(code(() => parseRange({ from: "2026-10-05", to: "2026-10-01" }, "2026-10-30")), 400);
  assert.strictEqual(code(() => parseRange({ from: "2026-01-01", to: "2026-10-01" }, "2026-10-30")), 400);
  // exactly 92 days is allowed, 93 is not
  assert.strictEqual(code(() => parseRange({ from: "2026-07-02", to: "2026-10-01" }, "2026-10-30")), null); // 92 days
  assert.strictEqual(code(() => parseRange({ from: "2026-07-01", to: "2026-10-01" }, "2026-10-30")), 400); // 93 days
});

test("toMap turns aggregate rows into a date map", () => {
  assert.deepStrictEqual(toMap([{ _id: "2026-10-01", n: 4 }, { _id: "2026-10-02", n: 0 }]), { "2026-10-01": 4, "2026-10-02": 0 });
  assert.deepStrictEqual(toMap(undefined), {});
});

test("buildActiveStats counts each person once per window", () => {
  const pairs = [
    { date: "2026-10-03", user: "a" }, { date: "2026-10-03", user: "a" }, { date: "2026-10-03", user: "b" },
    { date: "2026-10-01", user: "a" }, { date: "2026-10-01", user: "c" },
    { date: "2026-09-10", user: "d" },
  ];
  const s = buildActiveStats(pairs, "2026-10-03", 30);
  assert.strictEqual(s.today, 2);
  assert.strictEqual(s.last7, 3); // a, b, c  (d is older than 7 days)
  assert.strictEqual(s.window, 4); // a, b, c, d
  assert.strictEqual(s.daily.length, 30);
  assert.deepStrictEqual(s.daily[s.daily.length - 1], { date: "2026-10-03", count: 2 });
  assert.strictEqual(buildActiveStats([], "2026-10-03").window, 0);
});

test("buildReportRows fills zero and sumRows adds up", () => {
  const rows = buildReportRows(["2026-10-01", "2026-10-02"], {
    signups: { "2026-10-01": 2 }, tasbeehCount: { "2026-10-02": 99 }, tasbeehSessions: { "2026-10-02": 3 },
  });
  assert.deepStrictEqual(rows[0], { date: "2026-10-01", signups: 2, activeUsers: 0, readingActions: 0, tasbeehSessions: 0, tasbeehCount: 0, prayersLogged: 0 });
  assert.strictEqual(rows[1].tasbeehCount, 99);
  assert.deepStrictEqual(sumRows(rows), { signups: 2, readingActions: 0, tasbeehSessions: 3, tasbeehCount: 99, prayersLogged: 0 });
});

test("healthLevel", () => {
  assert.strictEqual(healthLevel({ dbOk: false, errors24h: 0 }).level, "problem");
  assert.strictEqual(healthLevel({ dbOk: true, errors24h: 1 }).label, "1 server error in 24 hours");
  assert.strictEqual(healthLevel({ dbOk: true, errors24h: 5 }).label, "5 server errors in 24 hours");
  assert.deepStrictEqual(healthLevel({ dbOk: true, errors24h: 0 }), { level: "ok", label: "Healthy" });
});

test("percentile and summarizeRequests", () => {
  assert.strictEqual(percentile([], 95), 0);
  assert.strictEqual(percentile([10, 20, 30, 40], 50), 20);
  assert.strictEqual(percentile([10, 20, 30, 40], 100), 40);
  assert.deepStrictEqual(summarizeRequests([]), { count: 0, avgMs: 0, p95Ms: 0, serverErrors: 0, errorRatePercent: 0 });
  const samples = Array.from({ length: 20 }, (_, i) => ({ ms: (i + 1) * 10, status: i === 0 ? 500 : 200 }));
  const s = summarizeRequests(samples);
  assert.strictEqual(s.count, 20);
  assert.strictEqual(s.avgMs, 105);
  assert.strictEqual(s.p95Ms, 190);
  assert.strictEqual(s.serverErrors, 1);
  assert.strictEqual(s.errorRatePercent, 5);
});

test("parseSettingsPatch accepts known keys only", () => {
  assert.deepStrictEqual(parseSettingsPatch({ registrationEnabled: false, siteNotice: "  Maintenance at 10pm  ", hacker: 1 }),
    { registrationEnabled: false, siteNotice: "Maintenance at 10pm" });
  assert.deepStrictEqual(parseSettingsPatch({ siteNotice: "" }), { siteNotice: "" });
});

test("parseSettingsPatch rejects wrong types, long notices and empty bodies", () => {
  assert.strictEqual(code(() => parseSettingsPatch({ ramadanEnabled: "yes" })), 400);
  assert.strictEqual(code(() => parseSettingsPatch({ siteNotice: 5 })), 400);
  assert.strictEqual(code(() => parseSettingsPatch({ siteNotice: "x".repeat(201) })), 400);
  assert.strictEqual(code(() => parseSettingsPatch({})), 400);
  assert.strictEqual(code(() => parseSettingsPatch(null)), 400);
  assert.strictEqual(code(() => parseSettingsPatch({ other: true })), 400);
});
