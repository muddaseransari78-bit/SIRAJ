import test from "node:test";
import assert from "node:assert";
import { buildSessionPayload, ayahsToRepeat } from "./recitationSession.js";

test("nothing to save gives null", () => {
  assert.strictEqual(buildSessionPayload(1, [], "2026-10-03"), null);
  assert.strictEqual(buildSessionPayload(1, undefined), null);
});

test("the payload keeps only numbers and the date", () => {
  const p = buildSessionPayload(2, [{ ayahNumber: 1, score: 80, problems: 1, heard: "secret", audio: "x" }], "2026-10-03");
  assert.deepStrictEqual(p, { surahNumber: 2, ayahs: [{ ayahNumber: 1, score: 80, problems: 1 }], date: "2026-10-03" });
  assert.strictEqual("date" in buildSessionPayload(2, [{ ayahNumber: 1, score: 1, problems: 0 }]), false);
});

test("an Ayah done twice keeps the last result", () => {
  const p = buildSessionPayload(1, [
    { ayahNumber: 1, score: 40, problems: 3 }, { ayahNumber: 2, score: 90, problems: 0 }, { ayahNumber: 1, score: 100, problems: 0 },
  ]);
  assert.deepStrictEqual(p.ayahs.map((a) => [a.ayahNumber, a.score]).sort(), [[1, 100], [2, 90]]);
});

test("numbers are rounded and clamped into the range the server accepts", () => {
  const p = buildSessionPayload(1, [{ ayahNumber: 3, score: 100.4, problems: -2 }, { ayahNumber: 4, score: 250, problems: 9999 }, { ayahNumber: 5, score: NaN, problems: 1.6 }]);
  assert.deepStrictEqual(p.ayahs, [
    { ayahNumber: 3, score: 100, problems: 0 }, { ayahNumber: 4, score: 100, problems: 400 }, { ayahNumber: 5, score: 0, problems: 2 },
  ]);
});

test("ayahsToRepeat lists Ayahs under the threshold", () => {
  assert.deepStrictEqual(ayahsToRepeat([{ ayahNumber: 1, score: 100 }, { ayahNumber: 2, score: 50 }, { ayahNumber: 3, score: 69 }, { ayahNumber: 4, score: 70 }]), [2, 3]);
  assert.deepStrictEqual(ayahsToRepeat(), []);
});
