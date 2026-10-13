import test from "node:test";
import assert from "node:assert";
import { compareRecitation, detectAyah, normalizeArabic } from "./recitationMatch.js";

const ayah = "ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَـٰلَمِينَ";

test("diacritics and alef forms are ignored", () => {
  assert.strictEqual(normalizeArabic("ٱلْحَمْدُ"), "الحمد");
});

test("a perfect recitation scores 100 with every word matched", () => {
  const r = compareRecitation(ayah, "الحمد لله رب العالمين");
  assert.strictEqual(r.score, 100);
  assert.ok(r.words.every((w) => w.status === "match"));
});

test("a skipped word is reported as missed", () => {
  const r = compareRecitation(ayah, "الحمد رب العالمين");
  assert.strictEqual(r.words[1].status, "missed");
  assert.ok(r.score < 100 && r.score > 0);
});

test("extra words are listed", () => {
  const r = compareRecitation(ayah, "الحمد لله رب العالمين ونعم");
  assert.deepStrictEqual(r.extra, ["ونعم"]);
});

test("silence scores 0", () => {
  assert.strictEqual(compareRecitation(ayah, "").score, 0);
});

test("detects the right Ayah and returns null for unrelated speech", () => {
  const list = [
    { numberInSurah: 3, text: "ٱلرَّحْمَٰنِ ٱلرَّحِيمِ" },
    { numberInSurah: 4, text: "مَـٰلِكِ يَوْمِ ٱلدِّينِ" },
  ];
  assert.strictEqual(detectAyah(list, "مالك يوم الدين").ayahNumber, 4);
  assert.strictEqual(detectAyah(list, "كلام غير معروف تماما"), null);
});
