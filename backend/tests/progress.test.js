// Phase 22 - tests for the reading-progress maths (streaks, dates, Khatm percent).
const test = require("node:test");
const assert = require("node:assert");
const {
  isValidDateString, dayDiff, addDays, resolveDate, computeStreaks, lastNDays, computeProgress,
} = require("../utils/progressMath");

test("isValidDateString accepts real dates only", () => {
  assert.strictEqual(isValidDateString("2026-10-04"), true);
  assert.strictEqual(isValidDateString("2028-02-29"), true); // leap year
  assert.strictEqual(isValidDateString("2027-02-29"), false);
  assert.strictEqual(isValidDateString("2026-13-01"), false);
  assert.strictEqual(isValidDateString("2026-1-1"), false);
  assert.strictEqual(isValidDateString("04-10-2026"), false);
  assert.strictEqual(isValidDateString(20261004), false);
  assert.strictEqual(isValidDateString(null), false);
});

test("addDays and dayDiff cross month and year ends", () => {
  assert.strictEqual(addDays("2026-12-31", 1), "2027-01-01");
  assert.strictEqual(addDays("2026-03-01", -1), "2026-02-28");
  assert.strictEqual(addDays("2028-03-01", -1), "2028-02-29");
  assert.strictEqual(dayDiff("2027-01-01", "2026-12-31"), 1);
  assert.strictEqual(dayDiff("2026-10-01", "2026-10-04"), -3);
});

test("resolveDate keeps a date within 1 day of the server date, otherwise uses the server date", () => {
  const now = "2026-10-04";
  assert.strictEqual(resolveDate("2026-10-04", now), "2026-10-04");
  assert.strictEqual(resolveDate("2026-10-05", now), "2026-10-05"); // user ahead (Pakistan)
  assert.strictEqual(resolveDate("2026-10-03", now), "2026-10-03"); // user behind (USA)
  assert.strictEqual(resolveDate("2026-10-10", now), now);          // faked far-away date
  assert.strictEqual(resolveDate("2020-01-01", now), now);
  assert.strictEqual(resolveDate("garbage", now), now);
  assert.strictEqual(resolveDate(undefined, now), now);
});

test("computeStreaks: no activity", () => {
  assert.deepStrictEqual(computeStreaks([], "2026-10-04"), { current: 0, longest: 0 });
});

test("computeStreaks: streak including today", () => {
  const r = computeStreaks(["2026-10-02", "2026-10-03", "2026-10-04"], "2026-10-04");
  assert.deepStrictEqual(r, { current: 3, longest: 3 });
});

test("computeStreaks: today still empty, streak counts back from yesterday", () => {
  const r = computeStreaks(["2026-10-02", "2026-10-03"], "2026-10-04");
  assert.strictEqual(r.current, 2);
});

test("computeStreaks: a gap of one full day breaks the current streak but longest remembers", () => {
  const dates = ["2026-09-20", "2026-09-21", "2026-09-22", "2026-09-23", "2026-10-03", "2026-10-04"];
  const r = computeStreaks(dates, "2026-10-04");
  assert.strictEqual(r.current, 2);
  assert.strictEqual(r.longest, 4);
});

test("computeStreaks: last activity two days ago means current streak is 0", () => {
  assert.strictEqual(computeStreaks(["2026-10-02"], "2026-10-04").current, 0);
});

test("computeStreaks: duplicates and unsorted input are fine", () => {
  const r = computeStreaks(["2026-10-04", "2026-10-03", "2026-10-04", "2026-10-02"], "2026-10-04");
  assert.deepStrictEqual(r, { current: 3, longest: 3 });
});

test("lastNDays is oldest-first and marks active days", () => {
  const out = lastNDays("2026-10-04", 3, new Set(["2026-10-03"]));
  assert.deepStrictEqual(out, [
    { date: "2026-10-02", active: false },
    { date: "2026-10-03", active: true },
    { date: "2026-10-04", active: false },
  ]);
});

test("computeProgress without Surah metadata counts 1/114 per Surah", () => {
  const r = computeProgress({ surahsCompleted: [1, 2, 3, 3, 999, 0], juzCompleted: [1, 2] });
  assert.strictEqual(r.surahsDone, 3);       // duplicate and out-of-range numbers ignored
  assert.strictEqual(r.juzDone, 2);
  assert.strictEqual(r.surahPercent, Math.round((3 / 114) * 100));
  assert.strictEqual(r.juzPercent, Math.round((2 / 30) * 100));
  assert.strictEqual(r.khatmPercent, Math.max(r.surahPercent, r.juzPercent));
  assert.strictEqual(r.ayahsRead, null);
});

test("computeProgress with metadata weights Surahs by Ayah count", () => {
  const surahMeta = Array.from({ length: 114 }, (_, i) => ({ number: i + 1, numberOfAyahs: i === 1 ? 286 : 1 }));
  const total = 286 + 113;
  const r = computeProgress({ surahsCompleted: [2], juzCompleted: [], surahMeta });
  assert.strictEqual(r.totalAyahs, total);
  assert.strictEqual(r.ayahsRead, 286);
  assert.strictEqual(r.surahPercent, Math.round((286 / total) * 100));
});

test("computeProgress ignores metadata that is not the full 114 Surahs", () => {
  const r = computeProgress({ surahsCompleted: [1], surahMeta: [{ number: 1, numberOfAyahs: 7 }] });
  assert.strictEqual(r.ayahsRead, null);
  assert.strictEqual(r.surahPercent, Math.round((1 / 114) * 100));
});

test("computeProgress: all done is exactly 100 and empty input is 0", () => {
  const all = Array.from({ length: 114 }, (_, i) => i + 1);
  assert.strictEqual(computeProgress({ surahsCompleted: all }).khatmPercent, 100);
  assert.strictEqual(computeProgress({}).khatmPercent, 0);
});
