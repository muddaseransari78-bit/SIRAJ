const axios = require("axios");
const cache = require("../../utils/cache");
const { CACHE_TTL_SECONDS } = require("../../config/constants");

const BASE_URL = process.env.ISLAMIC_API_BASE_URL || "https://api.islamic.app";
const { makeIslamicClient } = require("../../utils/islamicClient");
const client = makeIslamicClient(10000);
const unwrap = (r) => r.data.data;

// Always-available default (documented example slug of the source API).
const DEFAULT_SOURCES = [
  { slug: "ar-tafsir-ibn-kathir", name: "Tafsir Ibn Kathir", language: "Arabic" },
];

/**
 * Lists available Tafsir sources. The response shape is read defensively
 * so a small upstream change never breaks the page.
 */
async function getTafsirSources() {
  const cacheKey = "tafsir:sources";
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  let sources = null;
  try {
    const data = unwrap(await client.get("/v1/resources/tafsirs"));
    const list = Array.isArray(data) ? data : data?.tafsirs || data?.resources || [];
    const mapped = list
      .map((t) => ({
        slug: t.slug || String(t.id ?? t.resource_id ?? ""),
        name: t.name || t.resource_name || t.slug,
        language: t.language_name || t.language || "",
      }))
      .filter((t) => t.slug);
    if (mapped.length) sources = mapped;
  } catch (e) {
    // islamic.app not answering: try the Quran service below
  }

  if (!sources) {
    try {
      const base = process.env.QURAN_API_BASE_URL || "https://api.alquran.cloud/v1";
      const res = await axios.get(`${base}/edition/type/tafsir`, { timeout: 12000 });
      const mapped = (res.data.data || [])
        .map((e) => ({ slug: e.identifier, name: e.name || e.englishName, language: e.language }))
        .filter((t) => t.slug);
      if (mapped.length) sources = mapped;
    } catch (e) {
      // fall through
    }
  }

  if (!sources) return DEFAULT_SOURCES; // not cached, so the next visit tries again

  cache.set(cacheKey, sources, CACHE_TTL_SECONDS.QURAN_STATIC);
  return sources;
}

/**
 * One verse with Arabic text, an English translation and the chosen Tafsir.
 * The tafsir source name is always returned with the text.
 */
async function getTafsirForVerse(surah, ayah, sourceSlug) {
  const key = `tafsir:${surah}:${ayah}:${sourceSlug}`;
  const cached = cache.get(key);
  if (cached) return cached;

let response;
try {
  response = await client.get(`/v1/verses/by_key/${surah}:${ayah}`, {
    params: { translations: "en-sahih-international", tafsirs: sourceSlug },
  });
} catch (e) {
  console.warn("[SIRAJ] islamic.app tafsir failed, using alquran.cloud:", e.response ? e.response.status : e.message);
 return fallbackFromAlQuranCloud(surah, ayah, key, sourceSlug);
}
const verse = unwrap(response).verse;

  const result = {
    verseKey: verse.verse_key || `${surah}:${ayah}`,
    arabic: verse.text_uthmani,
    translation: verse.translations?.[0]
      ? { text: verse.translations[0].text, source: verse.translations[0].resource_name }
      : null,
    tafsirs: (verse.tafsirs || []).map((t) => ({
      slug: t.slug,
      source: t.resource_name,
      language: t.language_name,
      text: t.text,
    })),
  };

  cache.set(key, result, CACHE_TTL_SECONDS.QURAN_STATIC);
  return result;
}
async function fallbackFromAlQuranCloud(surah, ayah, key, sourceSlug) {
  const base = process.env.QURAN_API_BASE_URL || "https://api.alquran.cloud/v1";
  const wanted = String(sourceSlug || "").includes(".") ? sourceSlug : "ar.muyassar";
  async function load(edition) {
    const res = await axios.get(`${base}/ayah/${surah}:${ayah}/editions/quran-uthmani,en.sahih,${edition}`, { timeout: 12000 });
    return res.data.data;
  }
  let rows;
  try {
    rows = await load(wanted);
  } catch (e) {
    rows = await load("ar.muyassar");
  }
  const [ar, en, tf] = rows;
  const result = {
    verseKey: `${surah}:${ayah}`,
    arabic: ar.text,
    translation: { text: en.text, source: "Saheeh International" },
    tafsirs: [{
      slug: tf.edition?.identifier || wanted,
      source: tf.edition?.name || tf.edition?.englishName || "Tafsir",
      language: tf.edition?.language || "",
      text: tf.text,
    }],
  };
  cache.set(key, result, 60 * 60 * 6);
  return result;
}
module.exports = { getTafsirSources, getTafsirForVerse };
