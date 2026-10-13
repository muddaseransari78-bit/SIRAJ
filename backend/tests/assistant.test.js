const test = require("node:test");
const assert = require("node:assert");
const { interpret } = require("../services/assistantService");

const surahs = [
  { number: 1, englishName: "Al-Faatiha" },
  { number: 2, englishName: "Al-Baqara" },
  { number: 36, englishName: "Ya-Sin" },
  { number: 112, englishName: "Al-Ikhlaas" },
];

test("recognises a reference like 2:255", () => {
  assert.deepStrictEqual(interpret("2:255", surahs).reference, { surahNumber: 2, ayahNumber: 255 });
  assert.deepStrictEqual(interpret("surah 2 : 255", surahs).reference, { surahNumber: 2, ayahNumber: 255 });
});

test("rejects impossible references", () => {
  assert.strictEqual(interpret("115:1", surahs).reference, null);
  assert.strictEqual(interpret("0:5", surahs).reference, null);
});

test("knows Ayat al-Kursi by name", () => {
  assert.deepStrictEqual(interpret("Ayat al-Kursi", surahs).reference, { surahNumber: 2, ayahNumber: 255 });
});

test("finds a Surah by number and by name", () => {
  assert.strictEqual(interpret("surah 36", surahs).surah.number, 36);
  assert.strictEqual(interpret("surah baqara", surahs).surah.number, 2);
  assert.strictEqual(interpret("Yasin", surahs).surah.number, 36);
});

test("suggests SIRAJ pages and still keeps the search term", () => {
  const r = interpret("when is iftar", surahs);
  assert.ok(r.navigation.some((n) => n.to === "/ramadan"));
  assert.strictEqual(r.searchTerm, "when is iftar");
});

test("plain keywords give no reference and no Surah", () => {
  const r = interpret("patience", surahs);
  assert.strictEqual(r.reference, null);
  assert.strictEqual(r.surah, null);
});
