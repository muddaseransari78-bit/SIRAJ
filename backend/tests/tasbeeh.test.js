const test = require("node:test");
const assert = require("node:assert");
const { parseSession, readLocalDate, lastDays, isRealDate } = require("../utils/tasbeeh");

const NOW = Date.UTC(2026, 9, 2, 12, 0, 0); // 2026-10-02 12:00 UTC
const code = (fn) => { try { fn(); return null; } catch (e) { return e.statusCode; } };

test("valid session is cleaned", () => {
  const s = parseSession({ dhikr: "  SubhanAllah ", count: 33, target: 33, date: "2026-10-02" }, NOW);
  assert.deepStrictEqual(s, { dhikr: "SubhanAllah", count: 33, target: 33, date: "2026-10-02" });
});

test("target defaults to 33 and date defaults to the server date", () => {
  const s = parseSession({ dhikr: "Alhamdulillah", count: 5 }, NOW);
  assert.strictEqual(s.target, 33);
  assert.strictEqual(s.date, "2026-10-02");
});

test("bad counts and targets are rejected", () => {
  assert.strictEqual(code(() => parseSession({ dhikr: "x", count: 0 }, NOW)), 400);
  assert.strictEqual(code(() => parseSession({ dhikr: "x", count: 1.5 }, NOW)), 400);
  assert.strictEqual(code(() => parseSession({ dhikr: "x", count: "5" }, NOW)), 400);
  assert.strictEqual(code(() => parseSession({ dhikr: "x", count: 1000001 }, NOW)), 400);
  assert.strictEqual(code(() => parseSession({ dhikr: "x", count: 5, target: 0 }, NOW)), 400);
  assert.strictEqual(code(() => parseSession({ dhikr: "x", count: 5, target: 100001 }, NOW)), 400);
});

test("bad dhikr is rejected", () => {
  assert.strictEqual(code(() => parseSession({ dhikr: "", count: 5 }, NOW)), 400);
  assert.strictEqual(code(() => parseSession({ dhikr: "   ", count: 5 }, NOW)), 400);
  assert.strictEqual(code(() => parseSession({ dhikr: { $gt: "" }, count: 5 }, NOW)), 400);
  assert.strictEqual(code(() => parseSession({ dhikr: "a".repeat(101), count: 5 }, NOW)), 400);
  assert.strictEqual(code(() => parseSession(undefined, NOW)), 400);
});

test("dates: real days only, within 2 days of the server", () => {
  assert.strictEqual(isRealDate("2026-02-30"), false);
  assert.strictEqual(readLocalDate("2026-10-03", NOW), "2026-10-03"); // user ahead of UTC, e.g. Pakistan after midnight
  assert.strictEqual(readLocalDate("2026-10-01", NOW), "2026-10-01");
  assert.strictEqual(code(() => readLocalDate("2026-10-09", NOW)), 400);
  assert.strictEqual(code(() => readLocalDate("02-10-2026", NOW)), 400);
});

test("lastDays gives 7 consecutive days ending today (month change included)", () => {
  assert.deepStrictEqual(lastDays("2026-10-03", 7), ["2026-09-27", "2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03"]);
});
