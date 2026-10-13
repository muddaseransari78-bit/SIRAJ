import test from "node:test";
import assert from "node:assert";
import { methodLabel, madhabLabel, percentOf, heatLevel, bookmarkTarget, groupBookmarks, weekTotals, heatmapColumns } from "./dashboard.js";

test("method and madhab labels", () => {
  assert.strictEqual(methodLabel(3), "Muslim World League");
  assert.strictEqual(methodLabel(77), "Method 77");
  assert.strictEqual(madhabLabel(1), "Hanafi");
  assert.strictEqual(madhabLabel(0), "Shafi / Maliki / Hanbali");
});

test("percentOf is safe and capped", () => {
  assert.strictEqual(percentOf(1, 3), 33);
  assert.strictEqual(percentOf(5, 0), 0);
  assert.strictEqual(percentOf(9, 5), 100);
  assert.strictEqual(percentOf(-2, 5), 0);
});

test("heatLevel steps from 0 to 4", () => {
  assert.deepStrictEqual([0, 1, 2, 3, 4, 6, 7, 40].map(heatLevel), [0, 1, 2, 2, 3, 3, 4, 4]);
  assert.strictEqual(heatLevel(undefined), 0);
});

test("bookmarkTarget builds the right label and link", () => {
  assert.deepStrictEqual(bookmarkTarget({ type: "AYAH", surahNumber: 2, ayahNumber: 255 }), { label: "Quran 2:255", to: "/quran/2?ayah=255" });
  assert.deepStrictEqual(bookmarkTarget({ type: "SURAH", surahNumber: 18 }), { label: "Surah 18", to: "/quran/18" });
  assert.deepStrictEqual(bookmarkTarget({ type: "HADITH", hadithBook: "bukhari", hadithNumber: "1" }), { label: "bukhari #1", to: "/hadith/bukhari" });
  assert.deepStrictEqual(bookmarkTarget({ type: "DUA", duaRef: "x" }), { label: "Dua x", to: "/duas" });
});

test("groupBookmarks puts Surahs with the Quran items", () => {
  const g = groupBookmarks([{ type: "AYAH" }, { type: "SURAH" }, { type: "HADITH" }, { type: "DUA" }, { type: "DUA" }]);
  assert.deepStrictEqual([g.quran.length, g.hadith.length, g.duas.length], [2, 1, 2]);
  assert.deepStrictEqual(groupBookmarks(), { quran: [], hadith: [], duas: [] });
});

test("weekTotals", () => {
  assert.deepStrictEqual(weekTotals([{ count: 2 }, { count: 5 }, { count: 0 }]), { total: 7, max: 5 });
  assert.deepStrictEqual(weekTotals([]), { total: 0, max: 0 });
});

test("heatmapColumns pads the first week to start on Sunday", () => {
  // 2026-10-01 is a Thursday -> 4 empty cells before it
  const days = Array.from({ length: 10 }, (_, i) => ({ date: `2026-10-${String(i + 1).padStart(2, "0")}`, count: 0 }));
  const cols = heatmapColumns(days);
  assert.strictEqual(cols.length, 2);
  assert.deepStrictEqual(cols[0].slice(0, 4), [null, null, null, null]);
  assert.strictEqual(cols[0][4].date, "2026-10-01");
  assert.strictEqual(cols[1].length, 7); // 4 padding + 10 days = 14 cells
  assert.deepStrictEqual(heatmapColumns([]), []);
});
