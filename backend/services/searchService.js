// SIRAJ global search.
// NO text is generated here. Every result is a real record from the Quran / Hadith / Tafseer / Dua
// sources (or a link to a page of SIRAJ), returned together with its reference.
// Each source runs independently: if one is down the others still answer, and `errors` says which.

const M = require("../utils/searchMath");
const TOPICS = require("../config/topics");
const { SEARCH_TYPES, PAGES, DUA_LABELS } = require("../config/searchIndex");

const stripHtml = (v) => String(v || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const bundleText = (b) => (b ? stripHtml(b.text || b.body) : "");

// Real modules are loaded lazily so the pure parts can be tested without axios/mongoose installed.
function defaultDeps() {
  const quranApi = require("./external/quranApi");
  const hadithApi = require("./external/hadithApi");
  const tafsirApi = require("./external/tafsirApi");
  const duaQiblaApi = require("./external/duaQiblaApi");
  return {
    getSurahs: () => quranApi.getAllSurahs(),
    searchQuran: (keyword, edition) => quranApi.searchQuran(keyword, edition),
    searchHadiths: (q, opts) => hadithApi.searchHadiths(q, opts),
    getCollections: () => hadithApi.getCollections(),
    getBooks: (slug) => hadithApi.getBooks(slug),
    getTafsirSources: () => tafsirApi.getTafsirSources(),
    duaShortcuts: duaQiblaApi.DUA_SHORTCUTS,
    searchHisnDuas: (q) => searchDuas(q),
    searchCustomDuas: (q) => searchCustomDuas(q),
    customDuaCategories: async () => {
      const Dua = require("../models/Dua");
      const used = await Dua.distinct("category", { isActive: true });
      return used.filter((c) => !duaQiblaApi.DUA_SHORTCUTS.includes(c)).sort();
    },
  };
}

// ---------- Duas ----------

// Searches the (cached) Hisn al-Muslim categories. English, transliteration, Arabic (without harakat) and Urdu.
// Throws only if EVERY category failed to load.
async function searchDuas(q) {
  const duaQiblaApi = require("./external/duaQiblaApi");
  const script = M.detectScript(q);
  const needleLatin = q.toLowerCase();
  const needleArabic = M.normalizeArabic(q);
  const results = await Promise.allSettled(
    duaQiblaApi.DUA_SHORTCUTS.map(async (category) => ({ category, data: await duaQiblaApi.getDuasByCategory(category) }))
  );
  const found = [];
  let anyOk = false;
  results.forEach((r) => {
    if (r.status !== "fulfilled") return;
    anyOk = true;
    (r.value.data?.duas || []).forEach((d) => {
      const en = bundleText(d.en);
      const translit = stripHtml(d.transliteration?.en);
      const ar = bundleText(d.ar);
      const ur = bundleText(d.ur);
      const hit =
        script === "latin"
          ? en.toLowerCase().includes(needleLatin) || translit.toLowerCase().includes(needleLatin)
          : needleArabic && (M.normalizeArabic(ar).includes(needleArabic) || M.normalizeArabic(ur).includes(needleArabic));
      if (hit) {
        found.push({ category: r.value.category, en: en.slice(0, 240), ar: ar.slice(0, 160), ur: ur.slice(0, 160), source: stripHtml(d.source?.en), custom: false });
      }
    });
  });
  if (!anyOk) throw new Error("Dua sources unavailable");
  return found;
}

// Duas written by SIRAJ admins (they always carry a source). Escaped regex = no injection.
async function searchCustomDuas(q) {
  const Dua = require("../models/Dua");
  const re = new RegExp(M.escapeRegExp(q), "i");
  const rows = await Dua.find({
    isActive: true,
    $or: [{ title: re }, { english: re }, { transliteration: re }, { arabic: re }, { urdu: re }],
  }).limit(10);
  return rows.map((d) => ({
    category: d.category,
    title: d.title || "",
    en: String(d.english || "").slice(0, 240),
    ar: String(d.arabic || "").slice(0, 160),
    ur: String(d.urdu || "").slice(0, 160),
    source: d.source,
    custom: true,
  }));
}

// ---------- helpers ----------

const settle = async (promise) => {
  try { return { ok: true, value: await promise }; } catch (e) { return { ok: false, error: e }; }
};

// Which Quran editions to search for what the user typed.
function quranEditionsFor(script) {
  if (script === "arabic") return [{ edition: "quran-simple", kind: "arabic" }];
  if (script === "urdu") return [{ edition: "ur.jalandhry", kind: "urdu" }];
  return [{ edition: "en", kind: "translation" }, { edition: "en.transliteration", kind: "transliteration" }];
}

async function runQuranSearch(q, script, deps) {
  const keyword = script === "latin" ? q : M.stripArabicMarks(q);
  const editions = quranEditionsFor(script);
  const settled = await Promise.all(editions.map(async (e) => ({ ...e, res: await settle(deps.searchQuran(keyword, e.edition)) })));
  if (settled.every((s) => !s.res.ok)) throw settled[0].res.error;
  return M.mergeQuranGroups(settled.filter((s) => s.res.ok).map((s) => ({ kind: s.kind, items: s.res.value })));
}

async function runHadithSearch(q, hadithQuery, deps) {
  let collection = null;
  if (hadithQuery) {
    const cols = await settle(deps.getCollections());
    if (cols.ok && Array.isArray(cols.value)) collection = M.resolveCollection(hadithQuery, cols.value);
  }
  // "bukhari 7" -> look for 7 inside Bukhari; "bukhari patience" -> look for "patience" inside Bukhari
  let text = q;
  if (collection && hadithQuery.number !== null) text = String(hadithQuery.number);
  else if (collection && hadithQuery.rest) text = hadithQuery.rest;
  const raw = await deps.searchHadiths(text, { collection: collection?.slug, limit: 20 });
  let items = raw?.hadiths || raw?.results || [];

  let hadithReference = null;
  if (collection && hadithQuery.number !== null) {
    const same = (h) => String(h.hadithNumber) === String(hadithQuery.number);
    const exact = items.filter(same);
    const others = items.filter((h) => !same(h));
    items = [...exact.map((h) => ({ ...h, exactNumber: true })), ...others];
    hadithReference = { collection: collection.slug, collectionName: collection.name?.en || collection.slug, hadithNumber: hadithQuery.number, found: exact.length > 0 };
  }
  return { items, hadithReference };
}

async function runBooksSearch(q, hadithQuery, deps) {
  const colsRes = await deps.getCollections();
  const cols = Array.isArray(colsRes) ? colsRes : [];
  const out = [];
  const resolved = hadithQuery ? M.resolveCollection(hadithQuery, cols) : null;

  if (resolved) {
    out.push({ kind: "collection", slug: resolved.slug, name: resolved.name, to: `/hadith/${resolved.slug}` });
    if (hadithQuery.rest) {
      const books = await settle(deps.getBooks(resolved.slug));
      if (books.ok) {
        M.matchBooks(hadithQuery.rest, Array.isArray(books.value) ? books.value : []).slice(0, 8).forEach(({ book }) =>
          out.push({ kind: "book", slug: resolved.slug, collectionName: resolved.name?.en || resolved.slug, bookNumber: book.bookNumber, name: book.name, hadithCount: book.hadithCount ?? null, to: `/hadith/${resolved.slug}/${book.bookNumber}` })
        );
      }
    }
    return out;
  }
  M.matchCollections(q, cols).slice(0, 6).forEach(({ collection: c }) =>
    out.push({ kind: "collection", slug: c.slug, name: c.name, to: `/hadith/${c.slug}` })
  );
  return out;
}

async function duaCategoryList(deps) {
  let custom = [];
  try { custom = await deps.customDuaCategories(); } catch (e) { /* a database problem must not break search */ }
  return [...deps.duaShortcuts, ...custom];
}

// ---------- the main search ----------

/**
 * @param rawQuery  what the user typed (already length-checked by the controller)
 * @param opts      { types: [...SEARCH_TYPES], limit: 1..50 }
 * @param deps      injectable data sources (tests pass fakes)
 */
async function search(rawQuery, { types = SEARCH_TYPES, limit = 15 } = {}, deps = defaultDeps()) {
  const q = String(rawQuery || "").replace(/\s+/g, " ").trim();
  const want = (t) => types.includes(t);
  const script = M.detectScript(q);

  const surahsRes = await settle(deps.getSurahs());
  const surahs = surahsRes.ok ? surahsRes.value : [];
  const reference = M.parseReference(q, surahs);
  const hadithQuery = M.parseHadithQuery(q);
  const digitsOnly = /^[\d٠-٩۰-۹]+$/.test(q);

  const jobs = {};
  if (want("surahs")) jobs.surahs = async () => {
    if (!surahsRes.ok) throw surahsRes.error;
    return M.matchSurahs(q, surahs, 6).map(({ score, ...s }) => ({ ...s, to: `/quran/${s.number}` }));
  };
  // A reference like 2:255 or a bare number needs no text search - saves an external call.
  if (want("quran") && !reference && !digitsOnly) jobs.quran = () => runQuranSearch(q, script, deps);
  if (want("hadith")) jobs.hadith = () => runHadithSearch(q, hadithQuery, deps);
  if (want("books")) jobs.books = () => runBooksSearch(q, hadithQuery, deps);
  if (want("tafseer")) jobs.tafseer = async () => M.matchTafseerSources(q, await deps.getTafsirSources(), 6);
  if (want("duas")) {
    jobs.duasHisn = () => deps.searchHisnDuas(q);
    jobs.duasCustom = () => deps.searchCustomDuas(q);
    jobs.duaCategories = async () => M.matchDuaCategories(q, await duaCategoryList(deps), DUA_LABELS, 4);
  }
  if (want("topics")) jobs.topics = async () => M.matchTopics(q, TOPICS, 4);
  if (want("pages")) jobs.pages = async () => M.matchPages(q, PAGES, 5);

  const names = Object.keys(jobs);
  const settled = await Promise.allSettled(names.map((n) => jobs[n]()));
  const res = {};
  names.forEach((n, i) => { res[n] = settled[i]; });
  const val = (n, fallback) => (res[n]?.status === "fulfilled" ? res[n].value : fallback);
  const failed = (n) => res[n]?.status === "rejected";

  const quranAll = val("quran", []);
  const hadithRun = val("hadith", { items: [], hadithReference: null });
  const duasAll = [...val("duasCustom", []), ...val("duasHisn", [])];

  const data = {
    query: q,
    script,
    types,
    reference,
    hadithReference: hadithRun.hadithReference,
    surahs: val("surahs", []),
    quran: quranAll.slice(0, limit),
    quranTotal: quranAll.length,
    hadith: hadithRun.items.slice(0, limit),
    hadithBooks: val("books", []),
    tafseer: {
      sources: val("tafseer", []).map(({ score, ...s }) => ({ ...s, to: "/tafseer" })),
      // Tafseer is read Ayah by Ayah: the provider has no text search, so we never pretend to search inside it.
      note: "SIRAJ cannot search inside Tafseer text. Open the Tafseer of any Ayah from the Quran results, or search a reference like 2:255.",
    },
    duas: duasAll.slice(0, limit),
    duasTotal: duasAll.length,
    duaCategories: val("duaCategories", []).map(({ score, ...c }) => ({ ...c, to: `/duas/${c.slug}` })),
    topics: val("topics", []).map(({ score, ...t }) => ({ ...t, to: `/topics?t=${t.slug}` })),
    pages: val("pages", []).map(({ score, keywords, ...p }) => p),
    errors: {
      surahs: failed("surahs"),
      quran: failed("quran"),
      hadith: failed("hadith"),
      books: failed("books"),
      tafseer: failed("tafseer"),
      // Duas fail only if BOTH the Hisn al-Muslim source and the SIRAJ database failed
      duas: failed("duasHisn") && failed("duasCustom"),
    },
  };
  data.totals = {
    surahs: data.surahs.length,
    quran: data.quranTotal + (reference ? 1 : 0),
    hadith: data.hadith.length,
    books: data.hadithBooks.length,
    tafseer: data.tafseer.sources.length + (reference ? 1 : 0),
    duas: data.duasTotal + data.duaCategories.length,
    topics: data.topics.length,
    pages: data.pages.length,
  };
  return data;
}

// ---------- fast suggestions for the navbar box ----------
// Uses ONLY cached/local data (Surah list, collection list, pages, topics, dua labels): never a text search.

async function suggest(rawQuery, deps = defaultDeps()) {
  const q = String(rawQuery || "").replace(/\s+/g, " ").trim();
  const [surahsRes, colsRes] = await Promise.all([settle(deps.getSurahs()), settle(deps.getCollections())]);
  const surahs = surahsRes.ok ? surahsRes.value : [];
  const cols = colsRes.ok && Array.isArray(colsRes.value) ? colsRes.value : [];

  const reference = M.parseReference(q, surahs);
  const hq = M.parseHadithQuery(q);
  let hadithRef = null;
  if (hq) {
    const col = M.resolveCollection(hq, cols);
    if (col) {
      hadithRef = {
        label: hq.number !== null ? `${col.name?.en || col.slug} #${hq.number}` : col.name?.en || col.slug,
        sub: hq.number !== null ? "Search this Hadith number" : "Hadith collection",
        to: hq.number !== null ? `/search?q=${encodeURIComponent(q)}&type=hadith` : `/hadith/${col.slug}`,
      };
    }
  }

  const collections = hadithRef ? [] : M.matchCollections(q, cols).map((x) => x.collection);
  const surahHits = M.matchSurahs(q, surahs, 3);
  const pages = q.length >= 2 ? M.matchPages(q, PAGES, 2) : [];
  const topics = q.length >= 3 ? M.matchTopics(q, TOPICS, 2) : [];
  const duaCategories = q.length >= 3 ? M.matchDuaCategories(q, deps.duaShortcuts, DUA_LABELS, 2) : [];

  return {
    query: q,
    suggestions: M.buildSuggestions({ reference, hadithRef, surahs: surahHits, collections, pages, topics, duaCategories }, 8),
  };
}

module.exports = { search, suggest, searchDuas, searchCustomDuas, stripHtml, bundleText, SEARCH_TYPES };
