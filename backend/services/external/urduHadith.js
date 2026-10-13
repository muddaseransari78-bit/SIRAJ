// Phase 33 - Urdu translation of Hadith.
// The islamic.app API gives Arabic + English only. Urdu comes from the open "hadith-api" project
// (fawazahmed0/hadith-api on the jsDelivr CDN): one small JSON file per Hadith, e.g.
//   .../editions/urd-bukhari/1.json  ->  { hadithnumber, text, ... }
// If the file is missing or the CDN is down, the Hadith simply has no Urdu (the page says so). Nothing breaks.
const axios = require("axios");
const cache = require("../../utils/cache");

const BASE_URL = process.env.URDU_HADITH_BASE_URL || "https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions";
const WEEK = 7 * 24 * 3600;
const client = axios.create({ baseURL: BASE_URL, timeout: 4000 });

// Collections that have an Urdu edition. Keys are matched after removing spaces/dashes and lower-casing.
const EDITIONS = [
  { match: "bukhari", edition: "urd-bukhari" },
  { match: "muslim", edition: "urd-muslim" },
  { match: "abudawud", edition: "urd-abudawud" },
  { match: "tirmidhi", edition: "urd-tirmidhi" },
  { match: "nasai", edition: "urd-nasai" },
  { match: "ibnmajah", edition: "urd-ibnmajah" },
];

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z]/g, "");

function editionFor(collection) {
  const key = norm(collection);
  if (!key) return null;
  // "sahihmuslim" contains "muslim" but "bukhari" is checked first so "sahihbukhari" never matches muslim
  const hit = EDITIONS.find((e) => key.includes(e.match));
  return hit ? hit.edition : null;
}

// Only plain whole numbers exist in the Urdu files ("12" yes, "12a" no)
function numberOf(value) {
  const s = String(value ?? "").trim();
  return /^\d{1,6}$/.test(s) ? Number(s) : null;
}

async function fetchOne(collection, hadithNumber, http = client) {
  const edition = editionFor(collection);
  const number = numberOf(hadithNumber);
  if (!edition || number === null) return null;
  const key = `urdu-hadith:${edition}:${number}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached || null; // "" = we already know there is none
  try {
    const res = await http.get(`/${edition}/${number}.json`);
    const first = Array.isArray(res.data?.hadiths) ? res.data.hadiths[0] : null;
    const text = String(first?.text || "").trim();
    cache.set(key, text, WEEK);
    return text || null;
  } catch (e) {
    if (e.response && e.response.status === 404) cache.set(key, "", WEEK);
    return null; // network problems are not cached, so the next visit tries again
  }
}

/** Adds `ur: { text }` to every Hadith in the list that has an Urdu edition. Never throws. */
async function attachUrdu(hadiths, http = client) {
  if (!Array.isArray(hadiths)) return hadiths;
  const todo = hadiths.filter((h) => h && !h.ur && !h.urdu);
  for (let i = 0; i < todo.length; i += 10) {
    const chunk = todo.slice(i, i + 10);
    const texts = await Promise.all(chunk.map((h) => fetchOne(h.collection, h.hadithNumber, http).catch(() => null)));
    chunk.forEach((h, j) => { if (texts[j]) h.ur = { text: texts[j] }; });
  }
  return hadiths;
}

module.exports = { editionFor, numberOf, fetchOne, attachUrdu };
