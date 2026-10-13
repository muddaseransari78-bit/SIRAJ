const test = require("node:test");
const assert = require("node:assert");
const M = require("../utils/searchMath");
const { search, suggest } = require("../services/searchService");
const { SEARCH_TYPES, PAGES, DUA_LABELS } = require("../config/searchIndex");

const surahs = [
  { number: 1, name: "سُورَةُ ٱلْفَاتِحَةِ", englishName: "Al-Faatiha", englishNameTranslation: "The Opening", numberOfAyahs: 7, revelationType: "Meccan" },
  { number: 2, name: "سُورَةُ البَقَرَةِ", englishName: "Al-Baqara", englishNameTranslation: "The Cow", numberOfAyahs: 286, revelationType: "Medinan" },
  { number: 3, name: "سُورَةُ آلِ عِمۡرَانَ", englishName: "Aal-i-Imraan", englishNameTranslation: "The Family of Imraan", numberOfAyahs: 200, revelationType: "Medinan" },
  { number: 36, name: "سُورَةُ يسٓ", englishName: "Ya-Sin", englishNameTranslation: "Ya Sin", numberOfAyahs: 83, revelationType: "Meccan" },
  { number: 112, name: "سُورَةُ الإِخۡلَاصِ", englishName: "Al-Ikhlaas", englishNameTranslation: "Sincerity", numberOfAyahs: 4, revelationType: "Meccan" },
  { number: 114, name: "سُورَةُ النَّاسِ", englishName: "An-Naas", englishNameTranslation: "Mankind", numberOfAyahs: 6, revelationType: "Meccan" },
];
const collections = [
  { slug: "bukhari", name: { en: "Sahih al-Bukhari", ar: "صحيح البخاري" } },
  { slug: "muslim", name: { en: "Sahih Muslim", ar: "صحيح مسلم" } },
  { slug: "abudawud", name: { en: "Sunan Abi Dawud", ar: "سنن أبي داود" } },
  { slug: "ibnmajah", name: { en: "Sunan Ibn Majah", ar: "سنن ابن ماجه" } },
];

// ---------- normalisation ----------
test("digits in Arabic and Urdu form become normal digits", () => {
  assert.strictEqual(M.toAsciiDigits("٢:٢٥٥"), "2:255");
  assert.strictEqual(M.toAsciiDigits("۳۶"), "36");
});

test("Arabic comparison ignores harakat and alef/yeh variants", () => {
  assert.strictEqual(M.normalizeArabic("ٱلْحَمْدُ لِلَّهِ"), M.normalizeArabic("الحمد لله"));
  assert.strictEqual(M.normalizeArabic("أَحَد"), M.normalizeArabic("احد"));
});

test("script detection: latin, arabic, urdu", () => {
  assert.strictEqual(M.detectScript("patience"), "latin");
  assert.strictEqual(M.detectScript("الصبر"), "arabic");
  assert.strictEqual(M.detectScript("صبر کرنا"), "urdu");
});

test("tafseer / tafsir spelling is treated the same", () => {
  assert.strictEqual(M.canonLatin("Tafseer Ibn Katheer"), M.canonLatin("tafsir ibn kathir"));
});

// ---------- Quran references ----------
test("parses Quran references in several styles", () => {
  assert.deepStrictEqual(M.parseReference("2:255"), { surahNumber: 2, ayahNumber: 255 });
  assert.deepStrictEqual(M.parseReference("surah 36.5"), { surahNumber: 36, ayahNumber: 5 });
  assert.deepStrictEqual(M.parseReference("٢:٢٥٥"), { surahNumber: 2, ayahNumber: 255 });
  assert.deepStrictEqual(M.parseReference("2:255-257"), { surahNumber: 2, ayahNumber: 255, endAyah: 257 });
});

test("rejects impossible references", () => {
  assert.strictEqual(M.parseReference("115:1"), null);
  assert.strictEqual(M.parseReference("0:1"), null);
  assert.strictEqual(M.parseReference("112:5", surahs), null); // Al-Ikhlaas has 4 Ayahs
  assert.strictEqual(M.parseReference("patience"), null);
  assert.strictEqual(M.parseReference("2:255-250").endAyah, undefined);
});

// ---------- Surah names ----------
test("finds a Surah by number, name, typo and without Al-", () => {
  assert.strictEqual(M.matchSurahs("2", surahs)[0].number, 2);
  assert.strictEqual(M.matchSurahs("baqarah", surahs)[0].number, 2);
  assert.strictEqual(M.matchSurahs("surah fatiha", surahs)[0].number, 1);
  assert.strictEqual(M.matchSurahs("yaseen", surahs)[0].number, 36);
  assert.strictEqual(M.matchSurahs("imran", surahs)[0].number, 3);
  assert.strictEqual(M.matchSurahs("nas", surahs)[0].number, 114);
  assert.strictEqual(M.matchSurahs("ikhlas", surahs)[0].number, 112);
});

test("finds a Surah by its Arabic name (with or without harakat)", () => {
  assert.strictEqual(M.matchSurahs("البقرة", surahs)[0].number, 2);
  assert.strictEqual(M.matchSurahs("سورة الفاتحة", surahs)[0].number, 1);
  assert.strictEqual(M.matchSurahs("الإخلاص", surahs)[0].number, 112);
});

test("unrelated words match no Surah", () => {
  assert.deepStrictEqual(M.matchSurahs("zzzzzz", surahs), []);
  assert.deepStrictEqual(M.matchSurahs("999", surahs), []);
});

// ---------- Hadith ----------
test("parses hadith references and collection hints", () => {
  assert.deepStrictEqual(pick(M.parseHadithQuery("bukhari 1")), { key: "bukhari", number: 1, rest: "" });
  assert.deepStrictEqual(pick(M.parseHadithQuery("Sahih Muslim: 2564")), { key: "muslim", number: 2564, rest: "" });
  assert.deepStrictEqual(pick(M.parseHadithQuery("abu dawud hadith no 5")), { key: "abudawud", number: 5, rest: "" });
  assert.deepStrictEqual(pick(M.parseHadithQuery("bukhari revelation")), { key: "bukhari", number: null, rest: "revelation" });
  assert.strictEqual(M.parseHadithQuery("muslim brotherhood 5"), null);
  assert.strictEqual(M.parseHadithQuery("patience"), null);
});
function pick(p) { return p && { key: p.key, number: p.number, rest: p.rest }; }

test("a hadith reference finds the real collection from the live list", () => {
  assert.strictEqual(M.resolveCollection(M.parseHadithQuery("bukhari 1"), collections).slug, "bukhari");
  assert.strictEqual(M.resolveCollection(M.parseHadithQuery("abu dawud 5"), collections).slug, "abudawud");
  assert.strictEqual(M.resolveCollection(M.parseHadithQuery("ibn majah 2"), collections).slug, "ibnmajah");
});

test("collections are found by English or Arabic name", () => {
  assert.strictEqual(M.matchCollections("sunan", collections).length, 2);
  assert.strictEqual(M.matchCollections("صحيح مسلم", collections)[0].collection.slug, "muslim");
});

test("books are found by title words", () => {
  const books = [{ bookNumber: 1, name: { en: "Revelation" } }, { bookNumber: 2, name: { en: "Belief" } }, { bookNumber: 3, name: { en: "Book of Knowledge" } }];
  assert.strictEqual(M.matchBooks("revelation", books)[0].book.bookNumber, 1);
  assert.strictEqual(M.matchBooks("knowledge", books)[0].book.bookNumber, 3);
});

// ---------- pages / topics / duas / tafseer ----------
test("SIRAJ pages, topics, dua categories and tafseer sources are found", () => {
  assert.strictEqual(M.matchPages("qibla", PAGES)[0].to, "/qibla");
  assert.strictEqual(M.matchPages("iftar", PAGES)[0].to, "/ramadan");
  assert.strictEqual(M.matchPages("نماز", PAGES)[0].to, "/prayer");
  assert.strictEqual(M.matchTopics("patience", [{ slug: "patience", label: "Patience", keywords: ["patient"] }])[0].slug, "patience");
  assert.strictEqual(M.matchDuaCategories("sleep", ["morning", "before-sleep"], DUA_LABELS)[0].slug, "before-sleep");
  const sources = [{ slug: "ar-tafsir-ibn-kathir", name: "Tafsir Ibn Kathir" }, { slug: "en-tafsir-maarif-ul-quran", name: "Maarif-ul-Quran" }];
  assert.strictEqual(M.matchTafseerSources("tafseer ibn katheer", sources)[0].slug, "ar-tafsir-ibn-kathir");
});

test("unknown words match no page", () => {
  assert.deepStrictEqual(M.matchPages("xqzvw", PAGES), []);
});

// ---------- merging, options ----------
test("an Ayah found in two editions is listed once, with both match kinds", () => {
  const groups = [
    { kind: "translation", items: [{ surahNumber: 2, surahName: "Al-Baqara", ayahNumber: 153, text: "be patient" }, { surahNumber: 3, surahName: "Aal", ayahNumber: 200, text: "patient" }] },
    { kind: "transliteration", items: [{ surahNumber: 2, surahName: "Al-Baqara", ayahNumber: 153, text: "sabr" }] },
  ];
  const merged = M.mergeQuranGroups(groups);
  assert.strictEqual(merged.length, 2);
  assert.strictEqual(merged[0].ayahNumber, 153); // two matches ranks first
  assert.deepStrictEqual(merged[0].matches.map((m) => m.kind), ["translation", "transliteration"]);
});

test("limit and types are validated", () => {
  assert.strictEqual(M.clampInt("500", 1, 50, 15), 50);
  assert.strictEqual(M.clampInt("abc", 1, 50, 15), 15);
  assert.strictEqual(M.clampInt("0", 1, 50, 15), 1);
  assert.deepStrictEqual(M.parseTypes("quran, hadith,evil", SEARCH_TYPES), ["quran", "hadith"]);
  assert.deepStrictEqual(M.parseTypes("evil", SEARCH_TYPES), []);
  assert.deepStrictEqual(M.parseTypes(undefined, SEARCH_TYPES), SEARCH_TYPES);
});

test("regex characters typed by a user are escaped", () => {
  const re = new RegExp(M.escapeRegExp("(a+)+$"), "i");
  assert.ok(re.test("x (a+)+$ y"));
  assert.ok(!re.test("aaaa"));
});

// ---------- the whole search with FAKE sources ----------
function fakeDeps(overrides = {}) {
  return {
    getSurahs: async () => surahs,
    searchQuran: async (kw, edition) => {
      if (edition === "en") return [{ surahNumber: 2, surahName: "Al-Baqara", ayahNumber: 153, text: "Allah is with the patient" }];
      if (edition === "en.transliteration") return [];
      if (edition === "quran-simple") return [{ surahNumber: 1, surahName: "Al-Faatiha", ayahNumber: 2, text: "الحمد لله رب العالمين" }];
      return [];
    },
    searchHadiths: async (q, opts) => ({ hadiths: [{ collection: opts.collection || "bukhari", bookNumber: 1, hadithNumber: 9, en: { text: "x" } }, { collection: "bukhari", bookNumber: 1, hadithNumber: 1, en: { text: "intentions" } }] }),
    getCollections: async () => collections,
    getBooks: async () => [{ bookNumber: 1, name: { en: "Revelation" } }],
    getTafsirSources: async () => [{ slug: "ar-tafsir-ibn-kathir", name: "Tafsir Ibn Kathir" }],
    duaShortcuts: ["morning", "before-sleep"],
    searchHisnDuas: async () => [{ category: "morning", en: "patience dua", ar: "", ur: "", source: "Hisn", custom: false }],
    searchCustomDuas: async () => [],
    customDuaCategories: async () => ["gratitude-duas"],
    ...overrides,
  };
}

test("search: keyword returns every section and keeps the old response fields", async () => {
  const d = await search("patience", { types: SEARCH_TYPES, limit: 15 }, fakeDeps());
  assert.strictEqual(d.quran[0].ayahNumber, 153);
  assert.strictEqual(d.quran[0].matches[0].kind, "translation");
  assert.ok(Array.isArray(d.hadith) && Array.isArray(d.duas) && d.reference === null);
  assert.strictEqual(d.topics[0].slug, "patience");
  assert.strictEqual(d.duas[0].category, "morning");
  assert.strictEqual(d.errors.quran, false);
});

test("search: Arabic text searches the Arabic edition", async () => {
  const d = await search("الحمد لله", { types: ["quran"] }, fakeDeps());
  assert.strictEqual(d.script, "arabic");
  assert.strictEqual(d.quran[0].surahNumber, 1);
  assert.strictEqual(d.quran[0].matches[0].kind, "arabic");
});

test("search: 2:255 returns a reference and makes no Quran text search", async () => {
  let calls = 0;
  const d = await search("2:255", { types: ["quran", "tafseer"] }, fakeDeps({ searchQuran: async () => { calls++; return []; } }));
  assert.deepStrictEqual(d.reference, { surahNumber: 2, ayahNumber: 255 });
  assert.strictEqual(calls, 0);
  assert.strictEqual(d.totals.tafseer, 1);
});

test("search: a Surah name finds the Surah", async () => {
  const d = await search("baqarah", { types: ["surahs"] }, fakeDeps());
  assert.strictEqual(d.surahs[0].number, 2);
  assert.strictEqual(d.surahs[0].to, "/quran/2");
});

test("search: 'bukhari 1' searches inside Bukhari and puts the exact number first", async () => {
  let seen;
  const d = await search("bukhari 1", { types: ["hadith", "books"] }, fakeDeps({ searchHadiths: async (q, opts) => { seen = { q, opts }; return { hadiths: [{ collection: "bukhari", hadithNumber: 9 }, { collection: "bukhari", hadithNumber: 1 }] }; } }));
  assert.deepStrictEqual(seen, { q: "1", opts: { collection: "bukhari", limit: 20 } });
  assert.strictEqual(d.hadith[0].hadithNumber, 1);
  assert.strictEqual(d.hadith[0].exactNumber, true);
  assert.strictEqual(d.hadithReference.found, true);
  assert.strictEqual(d.hadithBooks[0].to, "/hadith/bukhari");
});

test("search: 'bukhari revelation' finds the book inside the collection", async () => {
  const d = await search("bukhari revelation", { types: ["books"] }, fakeDeps());
  assert.deepStrictEqual(d.hadithBooks.map((b) => b.kind), ["collection", "book"]);
  assert.strictEqual(d.hadithBooks[1].to, "/hadith/bukhari/1");
});

test("search: tafseer sources are found, and the honest note is always present", async () => {
  const d = await search("ibn kathir", { types: ["tafseer"] }, fakeDeps());
  assert.strictEqual(d.tafseer.sources[0].slug, "ar-tafsir-ibn-kathir");
  assert.match(d.tafseer.note, /cannot search inside Tafseer/);
});

test("search: one source failing does not break the others", async () => {
  const d = await search("patience", { types: SEARCH_TYPES }, fakeDeps({ searchHadiths: async () => { throw new Error("down"); }, searchQuran: async () => { throw new Error("down"); } }));
  assert.strictEqual(d.errors.hadith, true);
  assert.strictEqual(d.errors.quran, true);
  assert.deepStrictEqual(d.hadith, []);
  assert.strictEqual(d.topics[0].slug, "patience"); // local sources still answer
  assert.strictEqual(d.duas.length, 1);
  assert.strictEqual(d.errors.duas, false);
});

test("search: only the requested types are run", async () => {
  let hadithCalls = 0;
  await search("patience", { types: ["topics"] }, fakeDeps({ searchHadiths: async () => { hadithCalls++; return {}; } }));
  assert.strictEqual(hadithCalls, 0);
});

test("search: limit cuts the list but total keeps the real count", async () => {
  const many = Array.from({ length: 30 }, (_, i) => ({ surahNumber: 2, surahName: "Al-Baqara", ayahNumber: i + 1, text: "patient" }));
  const d = await search("patience", { types: ["quran"], limit: 5 }, fakeDeps({ searchQuran: async (kw, ed) => (ed === "en" ? many : []) }));
  assert.strictEqual(d.quran.length, 5);
  assert.strictEqual(d.quranTotal, 30);
});

test("search: Duas error only when both dua sources fail", async () => {
  const d = await search("patience", { types: ["duas"] }, fakeDeps({ searchHisnDuas: async () => { throw new Error("x"); }, searchCustomDuas: async () => { throw new Error("y"); } }));
  assert.strictEqual(d.errors.duas, true);
});

// ---------- suggestions ----------
test("suggest: typing 'baq' offers the Surah, with its Arabic name", async () => {
  const r = await suggest("baq", fakeDeps());
  assert.strictEqual(r.suggestions[0].type, "surah");
  assert.strictEqual(r.suggestions[0].to, "/quran/2");
  assert.ok(r.suggestions[0].arabic);
});

test("suggest: a reference goes first and links to the Ayah", async () => {
  const r = await suggest("2:255", fakeDeps());
  assert.strictEqual(r.suggestions[0].type, "reference");
  assert.strictEqual(r.suggestions[0].to, "/quran/2?ayah=255");
});

test("suggest: pages, collections and dua categories appear", async () => {
  assert.strictEqual((await suggest("qibla", fakeDeps())).suggestions[0].to, "/qibla");
  assert.ok((await suggest("bukhari", fakeDeps())).suggestions.some((s) => s.to === "/hadith/bukhari"));
  assert.ok((await suggest("sleep", fakeDeps())).suggestions.some((s) => s.to === "/duas/before-sleep"));
});

test("suggest: still answers when the Surah and Hadith sources are down", async () => {
  const r = await suggest("qibla", fakeDeps({ getSurahs: async () => { throw new Error("x"); }, getCollections: async () => { throw new Error("y"); } }));
  assert.strictEqual(r.suggestions[0].to, "/qibla");
});
