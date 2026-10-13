// Compares what the speech recogniser heard with the real Ayah text.
// IMPORTANT: this is a learning aid. Speech recognition makes mistakes, and this
// tool cannot judge Tajweed. It only compares WORDS.

// Removes diacritics (tashkeel), tatweel and unifies letter shapes so that
// "الْحَمْدُ" and "الحمد" compare equal.
export function normalizeArabic(text) {
  return (text || "")
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u08D3-\u08FF]/g, "") // marks
    .replace(/\u0640/g, "") // tatweel
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[^\u0621-\u064A\s]/g, " ") // drop punctuation / digits / Latin
    .replace(/\s+/g, " ")
    .trim();
}

// Comparison key: the Uthmani script writes some long "aa" sounds with a small mark
// (e.g. العلمين) while speech-to-text writes a full alef (العالمين). Dropping every
// alef from BOTH sides makes them equal. Words made only of alefs are kept as they are.
export function cmpKey(word) {
  return word.replace(/ا/g, "") || word;
}

export function splitWords(text) {
  const n = normalizeArabic(text);
  return n ? n.split(" ") : [];
}

// Edit distance between two words (small typos / near-miss sounds)
function editDistance(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[a.length][b.length];
}

export function wordScore(expected, heard) {
  if (expected === heard) return 1;
  const longest = Math.max(expected.length, heard.length);
  if (longest === 0) return 1;
  return 1 - editDistance(expected, heard) / longest;
}

export const CLOSE = 0.7; // "close enough" similarity for a single word

/**
 * Aligns expected Ayah words with heard words (Needleman-Wunsch style).
 * Returns one entry per expected word: { word, status, heard }
 *   status: "match" | "close" | "missed"
 * plus `extra` (words heard that are not in the Ayah) and a `score` 0-100.
 */
export function compareRecitation(ayahText, heardText) {
  const expectedDisplay = (ayahText || "").trim().split(/\s+/).filter(Boolean); // keeps diacritics for display
  const expected = expectedDisplay.map((w) => cmpKey(normalizeArabic(w)));
  const heardShown = splitWords(heardText); // shown to the user
  const heard = heardShown.map(cmpKey); // used for comparing

  const n = expected.length;
  const m = heard.length;
  const GAP = -0.6;
  const score = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  const back = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(""));
  for (let i = 1; i <= n; i++) { score[i][0] = i * GAP; back[i][0] = "U"; }
  for (let j = 1; j <= m; j++) { score[0][j] = j * GAP; back[0][j] = "L"; }
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const s = wordScore(expected[i - 1], heard[j - 1]);
      const pair = s >= CLOSE ? s : -1; // poor pairs are worse than a gap
      const options = [
        [score[i - 1][j - 1] + pair, "D"],
        [score[i - 1][j] + GAP, "U"],
        [score[i][j - 1] + GAP, "L"],
      ];
      options.sort((a, b) => b[0] - a[0]);
      score[i][j] = options[0][0];
      back[i][j] = options[0][1];
    }
  }

  const words = new Array(n);
  const extra = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    const step = back[i][j];
    if (step === "D") {
      const s = wordScore(expected[i - 1], heard[j - 1]);
      if (s >= CLOSE) {
        words[i - 1] = { word: expectedDisplay[i - 1], status: s === 1 ? "match" : "close", heard: heardShown[j - 1] };
      } else {
        words[i - 1] = { word: expectedDisplay[i - 1], status: "missed", heard: heardShown[j - 1] };
      }
      i--; j--;
    } else if (step === "U") {
      words[i - 1] = { word: expectedDisplay[i - 1], status: "missed", heard: null };
      i--;
    } else {
      extra.push(heardShown[j - 1]);
      j--;
    }
  }
  extra.reverse();

  const points = words.reduce((sum, w) => sum + (w.status === "match" ? 1 : w.status === "close" ? 0.6 : 0), 0);
  return { words, extra, score: n ? Math.round((points / n) * 100) : 0 };
}

/**
 * Finds which Ayah of a list best matches what was heard.
 * ayahs: [{ numberInSurah, text }]
 */
export function detectAyah(ayahs, heardText) {
  const heard = splitWords(heardText);
  if (heard.length < 2) return null;
  let best = null;
  ayahs.forEach((a) => {
    const r = compareRecitation(a.text, heardText);
    // Coverage of what was heard by this ayah
    const matchedHeard = r.words.filter((w) => w.status !== "missed").length;
    const coverage = matchedHeard / heard.length;
    const rank = (r.score / 100) * 0.5 + coverage * 0.5;
    if (!best || rank > best.rank) best = { ayahNumber: a.numberInSurah, rank, score: r.score };
  });
  return best && best.rank >= 0.35 ? best : null;
}
