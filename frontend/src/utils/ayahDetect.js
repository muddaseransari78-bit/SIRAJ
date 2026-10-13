// "Which Ayah am I reciting?" - finds the best matching Ayahs of ONE Surah for the words the browser heard.
// It only compares plain letters (no zabar / zer / pesh) and it only looks inside the Surah you picked.
// Speech recognition can be wrong, so the answer is always a suggestion for the reciter to confirm.
import { compareRecitation } from "./recitationMatch.js";

export const MIN_WORDS = 3; // fewer heard words than this is too little to decide anything
const MIN_RANK = 0.4;       // below this nothing is suggested
const TIE_GAP = 0.12;       // two candidates this close = "several Ayahs match"

/**
 * ayahs: [{ numberInSurah, text }]   heardWords: array of words (from splitWords)
 * Returns null, or { candidates: [{ ayahNumber, rank }] (best first, up to 3), confidence, ambiguous }
 *   confidence: "high" | "medium" | "low"
 *   ambiguous: true when another Ayah matches almost as well (the Quran repeats some phrases)
 */
export function detectAyahCandidates(ayahs, heardWords) {
  const heard = (heardWords || []).filter(Boolean);
  if (!Array.isArray(ayahs) || ayahs.length === 0 || heard.length < MIN_WORDS) return null;
  const heardText = heard.join(" ");

  const scored = ayahs.map((a) => {
    const r = compareRecitation(a.text, heardText);
    const real = r.words.length || 1;
    const matched = r.words.filter((w) => w.status !== "missed").length;
    const coverage = Math.min(1, matched / heard.length); // how much of what was heard is inside this Ayah
    const completeness = matched / real;                  // how much of this Ayah was heard
    return { ayahNumber: a.numberInSurah, rank: coverage * 0.75 + completeness * 0.25 };
  });

  scored.sort((x, y) => y.rank - x.rank || x.ayahNumber - y.ayahNumber);
  const best = scored[0];
  if (!best || best.rank < MIN_RANK) return null;

  const second = scored[1];
  const ambiguous = Boolean(second) && best.rank - second.rank < TIE_GAP && second.rank >= MIN_RANK;
  const confidence = ambiguous || best.rank < 0.6 ? (best.rank >= 0.6 ? "medium" : "low") : "high";
  return {
    candidates: scored.filter((s) => s.rank >= MIN_RANK).slice(0, 3).map((s) => ({ ayahNumber: s.ayahNumber, rank: Math.round(s.rank * 100) / 100 })),
    confidence,
    ambiguous,
  };
}
