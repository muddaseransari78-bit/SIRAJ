// Live (word-by-word) recitation matching.
//
// The browser's speech recogniser sends text while the user is still speaking.
// Every time new text arrives we re-run alignLive() on ALL the words heard so far
// and it tells us, for each word of the Ayah: not reached yet / reciting now /
// heard correctly / close / different word heard / skipped.
//
// IMPORTANT: this only compares WORDS. Browser speech-to-text returns plain Arabic
// letters WITHOUT zabar / zer / pesh, so vowel (harakat) mistakes and Tajweed
// mistakes can NOT be detected this way.
import { normalizeArabic, cmpKey, wordScore, CLOSE } from "./recitationMatch.js";

const LOOKAHEAD = 3; // how many words ahead we accept when the reciter skips a word

/**
 * ayahText:   the Ayah exactly as shown to the user (with diacritics)
 * heardWords: array of words from the recogniser (use splitWords() to make it)
 * Returns { words, current, done, doneAt, extra, score, problems }
 *   words[i] = { word, status, heard, retried }
 *   status: "upcoming" | "current" | "match" | "close" | "different" | "missed" | "neutral"
 *   current: index (in words) of the word the reciter should say next, or -1
 *   done: every word of the Ayah has been passed
 *   doneAt: how many heard words were used up when the Ayah was completed
 *   extra: words heard after the Ayah was completed (they belong to the next Ayah)
 */
export function alignLive(ayahText, heardWords) {
  const display = (ayahText || "").trim().split(/\s+/).filter(Boolean);
  const keys = display.map((w) => cmpKey(normalizeArabic(w)));
  // Waqf signs and similar marks have no letters: they are shown but never compared.
  const slots = [];
  keys.forEach((k, i) => { if (k) slots.push(i); });

  const words = display.map((w, i) => ({ word: w, status: keys[i] ? "upcoming" : "neutral", heard: null, retried: false }));
  let p = 0; // position inside slots
  let pendingBad = null; // a heard word that matched nothing at the current position
  let doneAt = 0;
  const extra = [];

  (heardWords || []).forEach((shown, heardIndex) => {
    if (p >= slots.length) { extra.push(shown); return; }
    const h = cmpKey(shown);
    let bestK = -1;
    let bestVal = -1;
    let bestScore = 0;
    const last = Math.min(slots.length, p + 1 + LOOKAHEAD);
    for (let k = p; k < last; k++) {
      const s = wordScore(keys[slots[k]], h);
      if (s >= CLOSE) {
        const val = s - 0.05 * (k - p); // prefer the nearest word
        if (val > bestVal) { bestVal = val; bestK = k; bestScore = s; }
      }
    }
    if (bestK >= 0) {
      for (let k = p; k < bestK; k++) {
        const w = words[slots[k]];
        if (k === p && pendingBad) { w.status = "different"; w.heard = pendingBad; } else { w.status = "missed"; }
      }
      const hit = words[slots[bestK]];
      hit.status = bestScore === 1 ? "match" : "close";
      hit.heard = shown;
      hit.retried = bestK === p && !!pendingBad; // said something else first, then corrected it
      p = bestK + 1;
      pendingBad = null;
      if (p >= slots.length) doneAt = heardIndex + 1;
    } else {
      pendingBad = shown;
    }
  });

  let current = -1;
  if (p < slots.length) {
    current = slots[p];
    if (pendingBad) { words[current].status = "different"; words[current].heard = pendingBad; } else { words[current].status = "current"; }
  }
  return { words, current, done: p >= slots.length, doneAt, extra, ...summarise(words) };
}

function summarise(words) {
  const real = words.filter((w) => w.status !== "neutral");
  const points = real.reduce((sum, w) => sum + (w.status === "match" ? 1 : w.status === "close" ? 0.6 : 0), 0);
  const problems = real.filter((w) => ["close", "different", "missed"].includes(w.status)).length;
  return { score: real.length ? Math.round((points / real.length) * 100) : 0, problems };
}

/** Ends an Ayah early: every word not reached yet is counted as "not heard". */
export function finalizeLive(live) {
  if (!live) return { score: 0, problems: 0, words: [] };
  const words = live.words.map((w) => (w.status === "upcoming" || w.status === "current" ? { ...w, status: "missed" } : w));
  return { words, ...summarise(words) };
}
