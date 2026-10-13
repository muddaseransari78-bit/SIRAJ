// Phase 34 - Urdu translation of Duas.
// The Hisn al-Muslim API (islamic.app) gives Arabic + English only, so most Duas have no Urdu.
// Here the English text is translated to Urdu with the free MyMemory service (no key needed).
//   - The result is cached for 30 days, and for Duas stored in our database it is SAVED, so each Dua is translated only once.
//   - It is a MACHINE translation: the card shows a small note saying so. An Urdu text typed by an admin always wins.
//   - If the service is down or says "limit reached", the Dua simply has no Urdu (the page says so). Nothing breaks.
// Optional .env: URDU_TRANSLATE_URL (other server), MYMEMORY_EMAIL (raises the free daily limit).
const axios = require("axios");
const crypto = require("crypto");
const cache = require("../../utils/cache");

const BASE_URL = process.env.URDU_TRANSLATE_URL || "https://api.mymemory.translated.net";
const MONTH = 30 * 24 * 3600;
const MAX_CHUNK = 450; // MyMemory accepts at most 500 characters per request
const client = axios.create({ baseURL: BASE_URL, timeout: 6000 });

const hasUrdu = (s) => /[\u0600-\u06FF]/.test(String(s || ""));

/** Cuts long English text into pieces of at most `max` characters, at sentence ends where possible. */
function splitText(text, max = MAX_CHUNK) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const sentences = clean.split(/(?<=[.!?;:])\s+/);
  const chunks = [];
  let current = "";
  for (const s of sentences) {
    if (s.length > max) { // one very long sentence: cut at spaces
      if (current) { chunks.push(current); current = ""; }
      let rest = s;
      while (rest.length > max) {
        let cut = rest.lastIndexOf(" ", max);
        if (cut < 1) cut = max;
        chunks.push(rest.slice(0, cut).trim());
        rest = rest.slice(cut).trim();
      }
      current = rest;
    } else if ((current + " " + s).trim().length > max) {
      chunks.push(current);
      current = s;
    } else {
      current = (current + " " + s).trim();
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

async function translateChunk(chunk, http) {
  const params = { q: chunk, langpair: "en|ur" };
  if (process.env.MYMEMORY_EMAIL) params.de = process.env.MYMEMORY_EMAIL;
  const res = await http.get("/get", { params });
  const status = Number(res.data?.responseStatus);
  const out = String(res.data?.responseData?.translatedText || "").trim();
  // Errors/limits come back as English text with a warning, so only accept real Urdu script
  if (status !== 200 || !out || /MYMEMORY WARNING/i.test(out) || !hasUrdu(out)) return null;
  return out;
}

/** English -> Urdu text, or null when it could not be done. Never throws. */
async function translateToUrdu(english, http = client) {
  const chunks = splitText(english);
  if (!chunks.length) return null;
  const key = `urdu-dua:${crypto.createHash("md5").update(chunks.join(" ")).digest("hex")}`;
  const cached = cache.get(key);
  if (cached) return cached;
  try {
    const parts = [];
    for (const c of chunks) {
      const t = await translateChunk(c, http);
      if (!t) return null; // half a translation is worse than none
      parts.push(t);
    }
    const text = parts.join(" ");
    cache.set(key, text, MONTH);
    return text;
  } catch (e) {
    return null; // network problems are not cached, so the next visit tries again
  }
}

const textOf = (v) => (v == null ? "" : typeof v === "string" ? v : (v.text ?? v.en ?? ""));

/**
 * Adds `ur: { text, machine: true }` to every Dua in the list that has English but no Urdu.
 * Used for the Duas that come straight from the outside API. Never throws.
 */
async function attachUrdu(duas, http = client) {
  if (!Array.isArray(duas)) return duas;
  const todo = duas.filter((d) => d && !textOf(d.ur).trim() && textOf(d.en).trim());
  for (let i = 0; i < todo.length; i += 4) {
    const chunk = todo.slice(i, i + 4);
    const texts = await Promise.all(chunk.map((d) => translateToUrdu(textOf(d.en), http).catch(() => null)));
    chunk.forEach((d, j) => { if (texts[j]) d.ur = { text: texts[j], machine: true }; });
  }
  return duas;
}

module.exports = { splitText, translateToUrdu, attachUrdu, hasUrdu };
