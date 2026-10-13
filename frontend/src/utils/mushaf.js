// Phase 30 - helpers for the Mushaf-style text view (Surah, Juz, Page, Hizb, Ruku).

export const BISMILLAH = "بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ";
const BISMILLAH_BASE = ["بسم", "الله", "الرحمن", "الرحيم"];

export const toArabicDigits = (n) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]);

// Letters only: no zabar / zer / pesh / Quran marks / tatweel, and Alef Wasla (ٱ) = plain Alef.
function baseLetters(word) {
  return word
    .replace(/[\u0640\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    .replace(/\u0671/g, "\u0627");
}

/**
 * Some Quran sources put the Bismillah in front of the first Ayah of a Surah.
 * Returns { bismillah, rest }: bismillah is the text of the 4 words (or null when the Ayah does not start with it).
 * Never call this for Surah 1 (there the Bismillah IS Ayah 1).
 */
export function splitBismillah(text) {
  const words = String(text || "").trim().split(/\s+/);
  if (words.length > BISMILLAH_BASE.length && BISMILLAH_BASE.every((b, i) => baseLetters(words[i]) === b)) {
    return { bismillah: words.slice(0, 4).join(" "), rest: words.slice(4).join(" ") };
  }
  return { bismillah: null, rest: String(text || "") };
}

/** True when a Surah starts with a separate Bismillah line (all except Al-Fatiha and At-Tawbah). */
export const hasBismillahLine = (surahNumber) => surahNumber !== 1 && surahNumber !== 9;

/** Consecutive Ayahs of the same Surah become one group (one heading + one flowing paragraph). */
export function groupBySurah(ayahs) {
  const groups = [];
  for (const a of ayahs || []) {
    const last = groups[groups.length - 1];
    if (last && last.surahNumber === a.surahNumber) last.items.push(a);
    else groups.push({ surahNumber: a.surahNumber, surahName: a.surahName, english: a.surahEnglishName, items: [a] });
  }
  return groups;
}
