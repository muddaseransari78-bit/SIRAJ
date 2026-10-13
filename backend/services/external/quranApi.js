const axios = require("axios");
const cache = require("../../utils/cache");
const { CACHE_TTL_SECONDS } = require("../../config/constants");

const BASE_URL = process.env.QURAN_API_BASE_URL || "https://api.alquran.cloud/v1";

const client = axios.create({ baseURL: BASE_URL, timeout: 10000 });

/**
 * Fetches the list of all 114 Surahs with their metadata
 * (name, arabic name, english name, revelation type, ayah count).
 * Cached for 24h since this data never changes.
 */
async function getAllSurahs() {
  const cacheKey = "quran:surahs:all";
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const response = await client.get("/surah");
  const surahs = response.data.data.map((s) => ({
    number: s.number,
    name: s.name, // Arabic name
    englishName: s.englishName,
    englishNameTranslation: s.englishNameTranslation,
    numberOfAyahs: s.numberOfAyahs,
    revelationType: s.revelationType, // "Meccan" | "Medinan"
  }));

  cache.set(cacheKey, surahs, CACHE_TTL_SECONDS.QURAN_STATIC);
  return surahs;
}

// Only these editions may be requested (prevents arbitrary values reaching the external API).
const ALLOWED_TRANSLATIONS = ["en.sahih", "en.asad", "en.pickthall", "en.yusufali"];
const URDU_EDITION = "ur.jalandhry"; // Fateh Muhammad Jalandhry
const TRANSLITERATION_EDITION = "en.transliteration";

// Browse-by types supported by AlQuran Cloud and their maximum number.
const RANGE_TYPES = {
  juz: { path: "juz", max: 30 },
  page: { path: "page", max: 604 },
  hizb: { path: "hizbQuarter", max: 240 }, // 240 hizb quarters (60 hizb x 4)
  ruku: { path: "ruku", max: 556 },
};

function isAllowedTranslation(edition) {
  return ALLOWED_TRANSLATIONS.includes(edition);
}

// Fetch one edition; return null instead of throwing (used for OPTIONAL editions such as Urdu).
async function fetchOptional(url) {
  try {
    const res = await client.get(url);
    return res.data.data;
  } catch (err) {
    return null;
  }
}

/**
 * Turns Arabic + optional edition payloads into one aligned ayah list.
 * All editions from AlQuran Cloud return ayahs in the same order, so we align by index.
 */
function mergeAyahs(arabicAyahs, english, urdu, translit) {
  return arabicAyahs.map((ayah, idx) => ({
    surahNumber: ayah.surah?.number,
    surahName: ayah.surah?.name,
    surahEnglishName: ayah.surah?.englishName,
    numberInSurah: ayah.numberInSurah,
    globalAyahNumber: ayah.number,
    arabicText: ayah.text,
    translationText: english?.ayahs?.[idx]?.text || "",
    urduText: urdu?.ayahs?.[idx]?.text || "",
    transliterationText: translit?.ayahs?.[idx]?.text || "",
    juz: ayah.juz,
    page: ayah.page,
    ruku: ayah.ruku,
    hizbQuarter: ayah.hizbQuarter,
  }));
}

/**
 * Fetches a full Surah: Arabic + English translation (required) and
 * Urdu translation + transliteration (optional - if they fail, the reader still works).
 * The source (edition name) of every layer is returned so the UI can always show it.
 */
async function getSurahDetail(surahNumber, translationEdition = "en.sahih") {
  const edition = isAllowedTranslation(translationEdition) ? translationEdition : "en.sahih";
  const cacheKey = `quran:surah:v2:${surahNumber}:${edition}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const [arabicRes, englishRes, urdu, translit] = await Promise.all([
    client.get(`/surah/${surahNumber}/quran-uthmani`),
    client.get(`/surah/${surahNumber}/${edition}`),
    fetchOptional(`/surah/${surahNumber}/${URDU_EDITION}`),
    fetchOptional(`/surah/${surahNumber}/${TRANSLITERATION_EDITION}`),
  ]);

  const arabicData = arabicRes.data.data;
  const englishData = englishRes.data.data;

  // The Surah endpoint does not repeat the surah on each ayah, so attach it here.
  const arabicAyahs = arabicData.ayahs.map((a) => ({
    ...a,
    surah: { number: arabicData.number, name: arabicData.name, englishName: arabicData.englishName },
  }));

  const result = {
    number: arabicData.number,
    name: arabicData.name,
    englishName: arabicData.englishName,
    englishNameTranslation: arabicData.englishNameTranslation,
    revelationType: arabicData.revelationType,
    numberOfAyahs: arabicData.numberOfAyahs,
    translationSource: englishData.edition?.englishName || edition,
    urduSource: urdu ? urdu.edition?.englishName || URDU_EDITION : null,
    transliterationSource: translit ? translit.edition?.englishName || TRANSLITERATION_EDITION : null,
    ayahs: mergeAyahs(arabicAyahs, englishData, urdu, translit),
  };

  cache.set(cacheKey, result, CACHE_TTL_SECONDS.QURAN_STATIC);
  return result;
}

/**
 * Fetches all ayahs of a Juz / Page / Hizb quarter / Ruku (they can span several Surahs).
 * type: "juz" | "page" | "hizb" | "ruku"
 */
async function getRange(type, number) {
  const cfg = RANGE_TYPES[type];
  if (!cfg) {
    const err = new Error("Unknown browse type. Use juz, page, hizb or ruku.");
    err.statusCode = 400;
    throw err;
  }
  if (!Number.isInteger(number) || number < 1 || number > cfg.max) {
    const err = new Error(`${type} number must be between 1 and ${cfg.max}`);
    err.statusCode = 400;
    throw err;
  }

  const cacheKey = `quran:range:v1:${type}:${number}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const [arabicRes, englishRes, urdu, translit] = await Promise.all([
    client.get(`/${cfg.path}/${number}/quran-uthmani`),
    client.get(`/${cfg.path}/${number}/en.sahih`),
    fetchOptional(`/${cfg.path}/${number}/${URDU_EDITION}`),
    fetchOptional(`/${cfg.path}/${number}/${TRANSLITERATION_EDITION}`),
  ]);

  const arabicData = arabicRes.data.data;
  const ayahs = mergeAyahs(arabicData.ayahs, englishRes.data.data, urdu, translit);

  const result = {
    type,
    number,
    max: cfg.max,
    translationSource: englishRes.data.data.edition?.englishName || "en.sahih",
    urduSource: urdu ? urdu.edition?.englishName || URDU_EDITION : null,
    transliterationSource: translit ? translit.edition?.englishName || TRANSLITERATION_EDITION : null,
    ayahs,
  };

  cache.set(cacheKey, result, CACHE_TTL_SECONDS.QURAN_STATIC);
  return result;
}

/**
 * Returns the audio recitation URL pattern info for a given reciter edition.
 * AlQuran Cloud exposes per-ayah audio via the CDN once we know the edition
 * identifier (e.g. "ar.alafasy"). We return the edition list so the frontend
 * can let the user choose a reciter.
 */
async function getAvailableReciters() {
  const cacheKey = "quran:reciters:all";
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const response = await client.get("/edition?format=audio&type=versebyverse");
  const reciters = response.data.data.map((r) => ({
    identifier: r.identifier,
    name: r.name,
    englishName: r.englishName,
    language: r.language,
  }));

  cache.set(cacheKey, reciters, CACHE_TTL_SECONDS.QURAN_STATIC);
  return reciters;
}

/**
 * Searches the Quran (Arabic or a given translation) for a keyword.
 */
async function searchQuran(keyword, edition = "en") {
  let response;
  try {
    response = await client.get(`/search/${encodeURIComponent(keyword)}/all/${edition}`);
  } catch (err) {
    // The provider answers 404 when nothing matches - that is "0 results", not "service down".
    if (err.response && err.response.status === 404) return [];
    throw err;
  }
  const matches = response.data?.data?.matches || [];
  const seen = new Set();
  const out = [];
  for (const m of matches) {
    const key = `${m.surah.number}:${m.numberInSurah}`;
    if (seen.has(key)) continue; // the same Ayah can come back once per translation edition
    seen.add(key);
    out.push({ surahNumber: m.surah.number, surahName: m.surah.englishName, ayahNumber: m.numberInSurah, text: m.text });
  }
  return out;
}

/**
 * Arabic + Urdu text of every Ayah of one Surah, as { [numberInSurah]: { ar, ur } } (cached 24h).
 * Used to show search / topic / source-finder results in the reader's own language.
 */
async function getSurahTexts(surahNumber) {
  const cacheKey = `quran:texts:v1:${surahNumber}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  let ar = null;
  let ur = null;
  try {
    const res = await client.get(`/surah/${surahNumber}/editions/quran-uthmani,${URDU_EDITION}`);
    const list = Array.isArray(res.data?.data) ? res.data.data : [];
    ar = list.find((e) => e.edition?.identifier === "quran-uthmani") || null;
    ur = list.find((e) => e.edition?.identifier === URDU_EDITION) || null;
  } catch (err) { /* fall back to one request per edition below */ }
  if (!ar) ar = await fetchOptional(`/surah/${surahNumber}/quran-uthmani`);
  if (!ur) ur = await fetchOptional(`/surah/${surahNumber}/${URDU_EDITION}`);
  if (!ar && !ur) return {}; // nothing cached on failure: the next request tries again

  const map = {};
  (ar?.ayahs || []).forEach((a) => { map[a.numberInSurah] = { ar: a.text, ur: "" }; });
  (ur?.ayahs || []).forEach((a) => {
    if (!map[a.numberInSurah]) map[a.numberInSurah] = { ar: "", ur: "" };
    map[a.numberInSurah].ur = a.text;
  });
  cache.set(cacheKey, map, CACHE_TTL_SECONDS.QURAN_STATIC);
  return map;
}

/**
 * Adds arabicText, urduText and surahArabicName to search-style results ({ surahNumber, ayahNumber, ... }).
 * Never throws: a result without the extra text is simply shown in English by the page.
 */
async function attachAyahTexts(results) {
  if (!Array.isArray(results) || results.length === 0) return results;
  const numbers = [...new Set(results.map((r) => r && r.surahNumber).filter((n) => Number.isInteger(n) && n >= 1 && n <= 114))];
  const texts = {};
  for (let i = 0; i < numbers.length; i += 6) {
    const group = numbers.slice(i, i + 6);
    const done = await Promise.allSettled(group.map((n) => getSurahTexts(n)));
    done.forEach((d, j) => { if (d.status === "fulfilled") texts[group[j]] = d.value; });
  }
  let names = {};
  try { (await getAllSurahs()).forEach((s) => { names[s.number] = s.name; }); } catch (e) { names = {}; }
  results.forEach((r) => {
    if (!r) return;
    const t = texts[r.surahNumber]?.[r.ayahNumber];
    if (t) { r.arabicText = t.ar || ""; r.urduText = t.ur || ""; }
    if (names[r.surahNumber]) r.surahArabicName = names[r.surahNumber];
  });
  return results;
}

/**
 * Per-ayah audio URLs for a whole Surah from a given reciter edition
 * (e.g. "ar.alafasy"). AlQuran Cloud returns an `audio` URL on every ayah
 * when an audio edition is requested.
 */
async function getSurahAudio(surahNumber, reciter = "ar.alafasy") {
  const cacheKey = `quran:audio:${surahNumber}:${reciter}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const response = await client.get(`/surah/${surahNumber}/${reciter}`);
  const data = response.data.data;

  const result = {
    surahNumber: data.number,
    reciter: data.edition?.identifier || reciter,
    reciterName: data.edition?.englishName || reciter,
    ayahs: data.ayahs
      .filter((a) => a.audio)
      .map((a) => ({ numberInSurah: a.numberInSurah, audio: a.audio })),
  };

  cache.set(cacheKey, result, CACHE_TTL_SECONDS.QURAN_STATIC);
  return result;
}

/**
 * Tajweed-marked text of a Surah (AlQuran Cloud "quran-tajweed" edition).
 * The text contains markers like [h:1[ٱ] that the frontend turns into coloured letters.
 * Returned separately from the normal Arabic text so the normal reader never depends on it.
 */
async function getSurahTajweed(surahNumber) {
  const cacheKey = `quran:tajweed:v1:${surahNumber}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const response = await client.get(`/surah/${surahNumber}/quran-tajweed`);
  const data = response.data.data;
  const result = {
    surahNumber: data.number,
    source: data.edition?.englishName || "Quran (Tajweed)",
    ayahs: data.ayahs.map((a) => ({ numberInSurah: a.numberInSurah, text: a.text })),
  };

  cache.set(cacheKey, result, CACHE_TTL_SECONDS.QURAN_STATIC);
  return result;
}

module.exports = { getAllSurahs, getSurahDetail, getRange, getAvailableReciters, searchQuran, getSurahAudio, getSurahTajweed, getSurahTexts, attachAyahTexts };
