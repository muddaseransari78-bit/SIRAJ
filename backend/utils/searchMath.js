// Pure helpers for the global search (no database, no network) so they are easy to test.
// IMPORTANT: nothing here creates or edits religious text. It only normalises what the user typed
// and decides which real records (Surah names, collections, pages...) match it.

// ---------- text normalisation ----------

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const URDU_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

// "٢:٢٥٥" -> "2:255" (Arabic-Indic and Urdu digits)
function toAsciiDigits(s) {
  return String(s || "").replace(/[٠-٩۰-۹]/g, (d) => {
    const a = ARABIC_DIGITS.indexOf(d);
    return String(a >= 0 ? a : URDU_DIGITS.indexOf(d));
  });
}

const MARKS_RE = /[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g; // harakat, small marks, tatweel

// Only removes harakat/tatweel (keeps the letters exactly as typed). Used when sending to the Quran API.
function stripArabicMarks(s) {
  return String(s || "").replace(MARKS_RE, "").replace(/\s+/g, " ").trim();
}

// Arabic/Urdu comparison form: no harakat, one alef, one yeh, one kaf.
function normalizeArabic(s) {
  return toAsciiDigits(String(s || "").normalize("NFKC"))
    .replace(MARKS_RE, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/[ىیيئ]/g, "ي")
    .replace(/[کك]/g, "ك")
    .replace(/ة/g, "ه")
    .replace(/[^\u0600-\u06FF0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Latin comparison form: lowercase, no accents, only letters/digits/spaces. "Al-Baqara" -> "al baqara"
function normalizeLatin(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Same as normalizeLatin, plus the few spellings people mix up (tafseer/tafsir, katheer/kathir).
function canonLatin(s) {
  return normalizeLatin(s).replace(/tafs[ei]{1,2}r/g, "tafsir").replace(/kath[ei]{1,2}r/g, "kathir");
}

const compact = (s) => canonLatin(s).replace(/ /g, "");

function detectScript(q) {
  const s = String(q || "");
  if (/[\u0679\u0688\u0691\u06BA\u06BE\u06C1\u06D2\u06AF\u0686\u067E\u0698\u06A9\u06CC]/.test(s)) return "urdu";
  if (/[\u0600-\u06FF]/.test(s)) return "arabic";
  return "latin";
}

// ---------- fuzzy scoring ----------

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

const collapseRepeats = (x) => x.replace(/(.)\1+/g, "$1"); // "naas" -> "nas", "ikhlaas" -> "iklas"

// 100 exact, 85 starts with, 65 contains, 55 one or two typos, 0 no match.
// Also tries the spelling with doubled letters collapsed, because Surah names are spelled "Naas"/"Nas", "Baqara"/"Baqarah".
function scoreCompact(q, name) {
  const direct = scoreCompactExact(q, name);
  if (direct >= 85) return direct;
  const cq = collapseRepeats(q);
  const cn = collapseRepeats(name);
  if (cq === q && cn === name) return direct;
  return Math.max(direct, Math.min(scoreCompactExact(cq, cn), 90));
}

function scoreCompactExact(q, name) {
  if (!q || !name) return 0;
  if (q === name) return 100;
  if (q.length >= 2 && name.startsWith(q)) return 85;
  if (q.length >= 3 && name.includes(q)) return 65;
  if (q.length >= 4) {
    const allowed = q.length >= 7 ? 2 : 1;
    if (levenshtein(q, name) <= allowed) return 55;
  }
  return 0;
}

// Every word the user typed must appear somewhere in the text. Good for titles ("ibn kathir").
function scoreWords(query, text) {
  const q = canonLatin(query);
  const t = canonLatin(text);
  if (!q || !t) return 0;
  const words = q.split(" ");
  if (!words.every((w) => t.includes(w))) return 0;
  let score = 60;
  if (t.includes(q)) score += 20;
  if (t.startsWith(q)) score += 10;
  return score;
}

// ---------- Quran references ----------

// "2:255", "2.255", "surah 2:255", "2:255-257", "٢:٢٥٥". Returns null if it is not a valid reference.
// Pass `surahs` (optional) to also reject an Ayah number beyond the Surah's length.
function parseReference(rawQuery, surahs = []) {
  const q = toAsciiDigits(rawQuery).trim().toLowerCase();
  const m = q.match(/^(?:surah\s*|sura\s*)?(\d{1,3})\s*[:.]\s*(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?$/);
  if (!m) return null;
  const surahNumber = Number(m[1]);
  const ayahNumber = Number(m[2]);
  if (surahNumber < 1 || surahNumber > 114 || ayahNumber < 1) return null;
  const surah = surahs.find((s) => s.number === surahNumber);
  if (surah && ayahNumber > surah.numberOfAyahs) return null;
  const ref = { surahNumber, ayahNumber };
  if (m[3]) {
    const endAyah = Number(m[3]);
    if (endAyah > ayahNumber && (!surah || endAyah <= surah.numberOfAyahs)) ref.endAyah = endAyah;
  }
  return ref;
}

// ---------- Surah names ----------

const LATIN_ARTICLE_RE = /^(aal|al|an|ash|as|ad|ar|at|az|adh|ath)\s+/;

function latinNameKeys(name) {
  const n = canonLatin(name);
  const keys = [n.replace(/ /g, "")];
  const stripped = n.replace(LATIN_ARTICLE_RE, "");
  if (stripped !== n) keys.push(stripped.replace(/ /g, ""));
  return keys.filter(Boolean);
}

function arabicNameKeys(name) {
  const n = normalizeArabic(name).replace(/^سوره\s*/, "");
  const keys = [n.replace(/ /g, "")];
  const noArticle = n.replace(/^ال/, "");
  if (noArticle !== n) keys.push(noArticle.replace(/ /g, ""));
  return keys.filter(Boolean);
}

/**
 * Finds Surahs whose number or name (English, translated English name, Arabic) matches the text.
 * Works with typos ("baqarah", "fatiha", "yaseen") and with or without "Al-".
 * surahs: [{ number, name, englishName, englishNameTranslation, numberOfAyahs, revelationType }]
 */
function matchSurahs(rawQuery, surahs = [], limit = 6) {
  const q = toAsciiDigits(rawQuery).trim();
  if (!q || !surahs.length) return [];

  // plain number -> that Surah
  if (/^\d{1,3}$/.test(q)) {
    const hit = surahs.find((s) => s.number === Number(q));
    return hit ? [{ ...hit, score: 100 }] : [];
  }

  const latinQ = compact(q.replace(/^(surah|sura|surat|soorah|soorat)\s+/i, "")).replace(/^(yaseen)$/, "yasin");
  const arabicQ = normalizeArabic(q).replace(/^سوره\s*/, "").replace(/ /g, "");
  const arabicQNoArticle = arabicQ.replace(/^ال/, "");
  const script = detectScript(q);

  const scored = surahs
    .map((s) => {
      let score = 0;
      if (script === "latin") {
        [s.englishName, s.englishNameTranslation].forEach((label, i) => {
          latinNameKeys(label).forEach((key) => {
            const raw = scoreCompact(latinQ, key);
            score = Math.max(score, i === 0 ? raw : Math.min(raw, 60)); // translated name ranks lower
          });
        });
        // "yasin" vs "ya-sin" vs "yaseen": compare without vowels too for names of 5+ letters
        if (score === 0 && latinQ.length >= 4) {
          const noVowel = (x) => x.replace(/[aeiou]/g, "");
          latinNameKeys(s.englishName).forEach((key) => {
            if (noVowel(latinQ) && noVowel(latinQ) === noVowel(key)) score = Math.max(score, 58);
          });
        }
      } else {
        arabicNameKeys(s.name).forEach((key) => {
          score = Math.max(score, scoreCompact(arabicQ, key), scoreCompact(arabicQNoArticle, key));
        });
      }
      return { ...s, score };
    })
    .filter((s) => s.score >= 55);

  return scored.sort((a, b) => b.score - a.score || a.number - b.number).slice(0, limit);
}

// ---------- Hadith references and collections ----------

// Words people use for each of the six major collections (Latin and Arabic script).
const HADITH_ALIASES = [
  { key: "bukhari", fragments: ["bukhari"], words: ["bukhari", "al bukhari", "sahih bukhari", "sahih al bukhari", "بخاري", "البخاري", "صحيح البخاري", "بخاری"] },
  { key: "muslim", fragments: ["muslim"], words: ["muslim", "sahih muslim", "مسلم", "صحيح مسلم"] },
  { key: "abudawud", fragments: ["dawud", "dawood", "daud"], words: ["abu dawud", "abu dawood", "abu daud", "abudawud", "sunan abu dawud", "abi dawud", "ابو داود", "أبو داود", "سنن ابي داود"] },
  { key: "tirmidhi", fragments: ["tirmidhi", "tirmizi", "termidhi"], words: ["tirmidhi", "tirmizi", "termidhi", "at tirmidhi", "jami at tirmidhi", "ترمذي", "الترمذي", "ترمذی"] },
  { key: "nasai", fragments: ["nasai", "nisai"], words: ["nasai", "nasa i", "an nasai", "sunan an nasai", "nisai", "نسائي", "النسائي", "نسائی"] },
  { key: "ibnmajah", fragments: ["majah", "maja"], words: ["ibn majah", "ibn maja", "ibnmajah", "sunan ibn majah", "ابن ماجه", "ابن ماجة", "ابن ماجہ"] },
];

const FILLER = new Set(["hadith", "hadees", "number", "no", "sahih", "sunan", "jami", "al", "an", "at", "of", "in", "the", "book"]);

function aliasMatchInfo(text) {
  const latin = canonLatin(text);
  const arabic = normalizeArabic(text);
  for (const group of HADITH_ALIASES) {
    for (const w of group.words) {
      const wl = canonLatin(w);
      const wa = normalizeArabic(w);
      if (wl && ` ${latin} `.includes(` ${wl} `)) {
        return { group, rest: ` ${latin} `.replace(` ${wl} `, " ").trim() };
      }
      if (wa && /[\u0600-\u06FF]/.test(w) && ` ${arabic} `.includes(` ${wa} `)) {
        return { group, rest: ` ${arabic} `.replace(` ${wa} `, " ").trim() };
      }
    }
  }
  return null;
}

/**
 * Understands "bukhari 1", "muslim:2564", "sahih bukhari hadith 7" and "bukhari revelation".
 * Returns { key, fragments, number, rest } or null. `number` is null when no number was typed;
 * `rest` is any leftover words (used to look for a book name inside that collection).
 */
function parseHadithQuery(rawQuery) {
  const q = toAsciiDigits(rawQuery).trim();
  if (!q) return null;
  let number = null;
  let text = q;
  const m = q.match(/^(.*?)[\s:#.,-]*(?:no\.?\s*|number\s*|#)?(\d{1,5})$/i);
  if (m && m[1].trim()) { text = m[1]; number = Number(m[2]); }
  const info = aliasMatchInfo(text);
  if (!info) return null;
  const restWords = info.rest.split(" ").filter((w) => w && !FILLER.has(w));
  // A number AND extra words ("muslim brotherhood 5") is not a reference
  if (number !== null && restWords.length > 0) return null;
  return { key: info.group.key, fragments: info.group.fragments, number, rest: restWords.join(" ") };
}

// Finds the real collection (from the live list) that a parsed hadith query points to.
function resolveCollection(parsed, collections = []) {
  if (!parsed) return null;
  return (
    collections.find((c) => {
      const hay = [compact(c.slug), compact(c.name?.en)];
      return parsed.fragments.some((f) => hay.some((h) => h.includes(f)));
    }) || null
  );
}

// Matches collection names/slugs against free text ("sunan", "bukhari", "ابن ماجه").
function matchCollections(rawQuery, collections = []) {
  const script = detectScript(rawQuery);
  const q = compact(rawQuery);
  const qa = normalizeArabic(rawQuery).replace(/ /g, "");
  const parsed = parseHadithQuery(rawQuery);
  return collections
    .map((c) => {
      let score = 0;
      if (script === "latin") {
        score = Math.max(scoreCompact(q, compact(c.slug)), scoreCompact(q, compact(c.name?.en)));
        if (parsed && resolveCollection({ fragments: parsed.fragments }, [c])) score = Math.max(score, 90);
      } else {
        score = scoreCompact(qa, normalizeArabic(c.name?.ar).replace(/ /g, ""));
        if (parsed && resolveCollection({ fragments: parsed.fragments }, [c])) score = Math.max(score, 90);
      }
      return { collection: c, score };
    })
    .filter((x) => x.score >= 55)
    .sort((a, b) => b.score - a.score);
}

// Books of one collection whose English/Arabic title contains every typed word.
function matchBooks(rawQuery, books = []) {
  const arabic = normalizeArabic(rawQuery);
  return books
    .map((b) => {
      const score = Math.max(scoreWords(rawQuery, b.name?.en), /[\u0600-\u06FF]/.test(rawQuery) && normalizeArabic(b.name?.ar).includes(arabic) ? 70 : 0);
      return { book: b, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
}

// ---------- SIRAJ pages, topics, dua categories, tafseer sources ----------

function bestKeywordScore(rawQuery, labels) {
  const q = compact(rawQuery);
  const qa = normalizeArabic(rawQuery).replace(/ /g, "");
  let best = 0;
  labels.forEach((label) => {
    best = Math.max(best, scoreCompact(q, compact(label)), scoreWords(rawQuery, label));
    if (qa && /[\u0600-\u06FF]/.test(label)) best = Math.max(best, scoreCompact(qa, normalizeArabic(label).replace(/ /g, "")));
  });
  return best;
}

function matchPages(rawQuery, pages = [], limit = 5) {
  return pages
    .map((p) => ({ ...p, score: Math.max(bestKeywordScore(rawQuery, [p.label, ...p.keywords]), 0) }))
    .filter((p) => p.score >= 60)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function matchTopics(rawQuery, topics = [], limit = 4) {
  return topics
    .map((t) => ({ slug: t.slug, label: t.label, score: bestKeywordScore(rawQuery, [t.label, t.slug.replace(/-/g, " "), ...t.keywords]) }))
    .filter((t) => t.score >= 60)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function matchDuaCategories(rawQuery, slugs = [], labels = {}, limit = 4) {
  return slugs
    .map((slug) => {
      const label = labels[slug] || slug.replace(/-/g, " ");
      return { slug, label, score: bestKeywordScore(rawQuery, [label, slug.replace(/-/g, " ")]) };
    })
    .filter((c) => c.score >= 60)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function matchTafseerSources(rawQuery, sources = [], limit = 6) {
  return sources
    .map((s) => ({ ...s, score: Math.max(scoreWords(rawQuery, s.name), scoreWords(rawQuery, s.slug.replace(/-/g, " "))) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// ---------- merging Quran results ----------

/**
 * groups: [{ kind: "translation" | "transliteration" | "arabic" | "urdu", items: [{ surahNumber, surahName, ayahNumber, text }] }]
 * One entry per Ayah, even if several editions matched it. Result is in Quran order,
 * with Ayahs that matched in more than one edition first.
 */
function mergeQuranGroups(groups = []) {
  const map = new Map();
  groups.forEach((g) => {
    (g.items || []).forEach((it) => {
      const key = `${it.surahNumber}:${it.ayahNumber}`;
      if (!map.has(key)) map.set(key, { surahNumber: it.surahNumber, surahName: it.surahName, ayahNumber: it.ayahNumber, text: it.text, matches: [] });
      const entry = map.get(key);
      if (!entry.matches.some((m) => m.kind === g.kind)) entry.matches.push({ kind: g.kind, text: it.text });
    });
  });
  return [...map.values()].sort((a, b) => b.matches.length - a.matches.length || a.surahNumber - b.surahNumber || a.ayahNumber - b.ayahNumber);
}

// ---------- request options ----------

function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

// "quran,hadith" -> ["quran","hadith"]; unknown names are dropped; empty -> all types.
function parseTypes(raw, allowed) {
  if (raw === undefined || raw === "") return [...allowed];
  const list = String(raw).split(",").map((s) => s.trim().toLowerCase()).filter((s) => allowed.includes(s));
  return [...new Set(list)];
}

// Safe to put inside new RegExp(...) (used for the admin-Dua database search).
const escapeRegExp = (s) => String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ---------- navbar suggestions ----------

/**
 * Builds the short dropdown list from already-matched pieces. Pure: no fetching here.
 * Returns up to `max` items: { type, label, sub, to, arabic? }
 */
function buildSuggestions({ reference, hadithRef, surahs = [], collections = [], pages = [], topics = [], duaCategories = [] }, max = 8) {
  const out = [];
  if (reference) {
    const to = `/quran/${reference.surahNumber}?ayah=${reference.ayahNumber}`;
    out.push({ type: "reference", label: `Quran ${reference.surahNumber}:${reference.ayahNumber}`, sub: "Go straight to this Ayah", to });
  }
  if (hadithRef) out.push({ type: "hadith", label: hadithRef.label, sub: hadithRef.sub, to: hadithRef.to });
  surahs.slice(0, 3).forEach((s) => out.push({ type: "surah", label: `${s.number}. ${s.englishName}`, sub: `${s.englishNameTranslation || ""} · ${s.numberOfAyahs} Ayahs`.replace(/^ · /, ""), arabic: s.name, to: `/quran/${s.number}` }));
  collections.slice(0, 2).forEach((c) => out.push({ type: "hadith", label: c.name?.en || c.slug, sub: "Hadith collection", arabic: c.name?.ar, to: `/hadith/${c.slug}` }));
  pages.slice(0, 2).forEach((p) => out.push({ type: "page", label: p.label, sub: p.description, to: p.to }));
  topics.slice(0, 2).forEach((t) => out.push({ type: "topic", label: t.label, sub: "Quran topic", to: `/topics?t=${t.slug}` }));
  duaCategories.slice(0, 2).forEach((c) => out.push({ type: "dua", label: `${c.label} Duas`, sub: "Duas & Adhkar", to: `/duas/${c.slug}` }));
  return out.slice(0, max);
}

module.exports = {
  toAsciiDigits, stripArabicMarks, normalizeArabic, normalizeLatin, canonLatin, detectScript,
  levenshtein, scoreCompact, scoreWords,
  parseReference, matchSurahs,
  HADITH_ALIASES, parseHadithQuery, resolveCollection, matchCollections, matchBooks,
  matchPages, matchTopics, matchDuaCategories, matchTafseerSources,
  mergeQuranGroups, clampInt, parseTypes, escapeRegExp, buildSuggestions,
};
