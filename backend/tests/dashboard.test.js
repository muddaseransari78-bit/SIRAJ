const test = require("node:test");
const assert = require("node:assert");
const {
  countByType, dayRange, fillDays, prayerDays, perPrayerTotals, fullDayStreak, clampDays,
} = require("../utils/dashboardMath");

test("countByType fills missing types with 0 and ignores unknown ones", () => {
  const out = countByType([{ _id: "AYAH", count: 4 }, { _id: "DUA", count: 2 }, { _id: "WEIRD", count: 9 }]);
  assert.deepStrictEqual(out, { total: 6, AYAH: 4, SURAH: 0, HADITH: 0, DUA: 2 });
  assert.strictEqual(countByType().total, 0);
});

test("dayRange ends today, oldest first, and crosses month borders", () => {
  assert.deepStrictEqual(dayRange("2026-10-02", 4), ["2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"]);
});

test("fillDays puts zero on days with no data", () => {
  const out = fillDays("2026-10-03", 3, [{ _id: "2026-10-01", count: 5 }, { _id: "2026-10-03", count: 2 }]);
  assert.deepStrictEqual(out, [
    { date: "2026-10-01", count: 5 }, { date: "2026-10-02", count: 0 }, { date: "2026-10-03", count: 2 },
  ]);
});

test("prayerDays builds a per-prayer map and a count", () => {
  const days = prayerDays("2026-10-02", 2, [
    { date: "2026-10-02", prayer: "Fajr" }, { date: "2026-10-02", prayer: "Isha" },
    { date: "2026-10-01", prayer: "Asr" }, { date: "2026-10-01", prayer: "NotAPrayer" },
  ]);
  assert.strictEqual(days[1].count, 2);
  assert.deepStrictEqual(days[1].done, { Fajr: true, Dhuhr: false, Asr: false, Maghrib: false, Isha: true });
  assert.strictEqual(days[0].count, 1);
});

const full = (date) => ({ date, count: 5, done: {} });
const part = (date, count) => ({ date, count, done: {} });

test("streak counts back from yesterday when today is still in progress", () => {
  assert.strictEqual(fullDayStreak([full("a"), full("b"), part("c", 2)]), 2);
});

test("streak includes today once it is complete and stops at the first gap", () => {
  assert.strictEqual(fullDayStreak([part("a", 4), full("b"), full("c"), full("d")]), 3);
  assert.strictEqual(fullDayStreak([part("a", 0), part("b", 0)]), 0);
});

test("perPrayerTotals counts each prayer across days", () => {
  const days = prayerDays("2026-10-02", 3, [
    { date: "2026-10-02", prayer: "Fajr" }, { date: "2026-10-01", prayer: "Fajr" }, { date: "2026-09-30", prayer: "Isha" },
  ]);
  assert.deepStrictEqual(perPrayerTotals(days), { Fajr: 2, Dhuhr: 0, Asr: 0, Maghrib: 0, Isha: 1 });
});

test("clampDays falls back for bad input and caps big values", () => {
  assert.strictEqual(clampDays(undefined, 30, 90), 30);
  assert.strictEqual(clampDays("abc", 30, 90), 30);
  assert.strictEqual(clampDays("-5", 30, 90), 30);
  assert.strictEqual(clampDays("1.5", 30, 90), 30);
  assert.strictEqual(clampDays("14", 30, 90), 14);
  assert.strictEqual(clampDays("5000", 30, 90), 90);
});
