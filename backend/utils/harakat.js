// Compares the harakat (zabar / zer / pesh / sukoon / shadda / tanween) of what a
// pronunciation model heard with the harakat of the real Ayah.
//
// IMPORTANT - what this can and cannot do:
//  * It only works if the model returns Arabic text WITH harakat. If it returns plain letters
//    (most speech-to-text does) we say "could not check" instead of pretending everything is fine.
//  * It compares vowels and shadda only. It does NOT judge Tajweed rules that depend on timing or
//    sound quality (madd length, ghunnah, ikhfa, qalqalah, makharij).
//  * Only differences the model clearly shows are reported. If the model gave no mark at all for a
//    letter, that letter is counted as "unclear", never as a mistake.

const VOWELS = {
  "\u064E": "fatha", "\u064F": "damma", "\u0650": "kasra",
  "\u0652": "sukun", "\u06E1": "sukun",
  "\u064B": "fathatan", "\u08F0": "fathatan",
  "\u064C": "dammatan", "\u08F1": "dammatan",
  "\u064D": "kasratan", "\u08F2": "kasratan",
};
const SHADDA = "\u0651";
const TATWEEL = "\u0640";
const HAMZA_FORMS = "\u0621\u0623\u0624\u0625\u0626"; // ء أ ؤ إ ئ (آ is handled below)

// Returns: a letter key, null for a plain alef (it carries no vowel of its own), or undefined for non-letters.
function letterKey(ch) {
  if (ch === TATWEEL) return undefined;
  if (ch === "\u0627" || ch === "\u0671") return null; // ا ٱ
  if (ch === "\u0622" || HAMZA_FORMS.includes(ch)) return "\u0621"; // آ and every hamza form -> ء
  if (ch === "\u0649") return "\u064A"; // ى -> ي
  if (ch === "\u0629") return "\u0647"; // ة -> ه
  if (ch >= "\u0621" && ch <= "\u064A") return ch;
  return undefined;
}

/** One entry per letter that can carry a vowel: { letter, vowel, shadda } */
function parseUnits(word) {
  const units = [];
  for (const ch of String(word || "")) {
    const key = letterKey(ch);
    if (key !== undefined) {
      units.push({ letter: key, vowel: null, shadda: false });
    } else if (units.length) {
      const last = units[units.length - 1];
      if (ch === SHADDA) last.shadda = true;
      else if (VOWELS[ch]) last.vowel = VOWELS[ch];
    }
  }
  return units.filter((u) => u.letter !== null);
}

function wordKey(word) {
  return parseUnits(word).map((u) => u.letter).join("");
}

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

function similarity(a, b) {
  if (a === b) return 1;
  const longest = Math.max(a.length, b.length);
  return longest === 0 ? 1 : 1 - editDistance(a, b) / longest;
}

const CLOSE = 0.7;

/** Pairs expected words with heard words. Returns an array (one per expected word) of heard index or -1. */
function alignWords(expectedKeys, heardKeys) {
  const n = expectedKeys.length;
  const m = heardKeys.length;
  const GAP = -0.6;
  const score = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  const back = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(""));
  for (let i = 1; i <= n; i++) { score[i][0] = i * GAP; back[i][0] = "U"; }
  for (let j = 1; j <= m; j++) { score[0][j] = j * GAP; back[0][j] = "L"; }
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const s = similarity(expectedKeys[i - 1], heardKeys[j - 1]);
      const options = [
        [score[i - 1][j - 1] + (s >= CLOSE ? s : -1), "D"],
        [score[i - 1][j] + GAP, "U"],
        [score[i][j - 1] + GAP, "L"],
      ];
      options.sort((x, y) => y[0] - x[0]);
      score[i][j] = options[0][0];
      back[i][j] = options[0][1];
    }
  }
  const pairs = new Array(n).fill(-1);
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    const step = back[i][j];
    if (step === "D") {
      if (similarity(expectedKeys[i - 1], heardKeys[j - 1]) >= CLOSE) pairs[i - 1] = j - 1;
      i--; j--;
    } else if (step === "U") { i--; } else { j--; }
  }
  return pairs;
}

/** Pairs the letters of two words (edit-distance alignment). Returns [[expectedIndex, heardIndex], ...] for equal letters. */
function alignUnits(expected, heard) {
  const n = expected.length;
  const m = heard.length;
  const dp = Array.from({ length: n + 1 }, (_, i) => [i]);
  for (let j = 1; j <= m; j++) dp[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (expected[i - 1].letter === heard[j - 1].letter ? 0 : 1));
    }
  }
  const pairs = [];
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    const same = expected[i - 1].letter === heard[j - 1].letter;
    if (dp[i][j] === dp[i - 1][j - 1] + (same ? 0 : 1)) {
      if (same) pairs.push([i - 1, j - 1]);
      i--; j--;
    } else if (dp[i][j] === dp[i - 1][j] + 1) { i--; } else { j--; }
  }
  return pairs.reverse();
}

/**
 * Compares the harakat of ONE word.
 * ignoreLast: skip the last letter (a reciter who stops at the end of the Ayah does not say its vowel).
 * Returns { diffs, unclear }.
 */
function compareWordMarks(expectedWord, heardWord, { ignoreLast = false } = {}) {
  const E = parseUnits(expectedWord);
  const H = parseUnits(heardWord);
  const diffs = [];
  let unclear = 0;
  alignUnits(E, H).forEach(([ei, hi]) => {
    if (ignoreLast && ei === E.length - 1) return;
    const e = E[ei];
    const h = H[hi];
    const heardHasMark = Boolean(h.vowel || h.shadda);
    if (e.vowel) {
      // A reciter may legitimately STOP on any word (at a waqf sign or to breathe): the last letter is then said with
      // sukun instead of its vowel. That is correct recitation, so it is not reported (only a different VOWEL there is).
      const stoppedHere = ei === E.length - 1 && h.vowel === "sukun" && e.vowel !== "sukun";
      if (!h.vowel) { unclear++; } else if (stoppedHere) { /* waqf: fine */ } else if (h.vowel !== e.vowel) {
        diffs.push({ position: ei, letter: e.letter, kind: "vowel", expected: e.vowel, heard: h.vowel });
      }
    }
    if (e.shadda) {
      if (!heardHasMark) { unclear++; } else if (!h.shadda) {
        diffs.push({ position: ei, letter: e.letter, kind: "shadda", expected: "shadda", heard: null });
      }
    }
  });
  return { diffs, unclear };
}

/** Share (0-1) of heard letters that carry any mark. Used to notice a model that returns plain letters. */
function markCoverage(text) {
  const units = String(text || "").split(/\s+/).flatMap((w) => parseUnits(w));
  if (units.length === 0) return 0;
  return units.filter((u) => u.vowel || u.shadda).length / units.length;
}

const MIN_COVERAGE = 0.3;

/**
 * expectedText: the Ayah with harakat. heardText: what the model heard (should have harakat).
 * Word status: "ok" | "harakat" (a vowel/shadda differs) | "unclear" | "notheard" | "pending" (live mode: not reached yet) | "neutral" (waqf sign etc.)
 */
function checkHarakat(expectedText, heardText, { partial = false } = {}) {
  const expectedWords = String(expectedText || "").trim().split(/\s+/).filter(Boolean);
  let heardWords = String(heardText || "").trim().split(/\s+/).filter(Boolean);
  const coverage = markCoverage(heardText);
  // LIVE mode: the recording is still going on. The last heard word may be cut in the middle
  // (the model sees half a word), so it is not judged yet. Words the reciter has not reached
  // are "pending", not "not heard".
  if (partial && heardWords.length) heardWords = heardWords.slice(0, -1);

  const empty = { ok: 0, wrong: 0, unclear: 0, notHeard: 0, pending: 0, score: null };
  if (wordKey(heardWords.join(" ")) === "") {
    if (partial) { // nothing judgeable yet: not an error, just wait for more audio
      const words = expectedWords.map((word, i) => ({ word, status: wordKey(word) ? "pending" : "neutral", heard: null, diffs: [] }));
      return { available: true, partial: true, reason: null, coverage, words, extra: [], summary: { ...empty, words: words.filter((w) => w.status !== "neutral").length, pending: words.filter((w) => w.status === "pending").length } };
    }
    return { available: false, reason: "nothing-heard", coverage, words: [], extra: [], summary: { ...empty, words: 0 } };
  }
  if (coverage < MIN_COVERAGE) {
    return { available: false, reason: "no-harakat", coverage, words: [], extra: [], summary: { ...empty, words: 0 } };
  }

  const expectedKeys = expectedWords.map(wordKey);
  const heardKeys = heardWords.map(wordKey);
  const slots = []; // expected words that have letters
  expectedKeys.forEach((k, i) => { if (k) slots.push(i); });
  const heardSlots = [];
  heardKeys.forEach((k, i) => { if (k) heardSlots.push(i); });

  const pairs = alignWords(slots.map((i) => expectedKeys[i]), heardSlots.map((i) => heardKeys[i]));
  const usedHeard = new Set();
  const lastSlot = slots[slots.length - 1];

  // Slot position of the furthest expected word that was matched (live mode: everything after it is still pending)
  let lastPaired = -1;
  pairs.forEach((hp, s) => { if (hp >= 0) lastPaired = s; });
  const words = expectedWords.map((word, i) => ({ word, status: expectedKeys[i] ? "notheard" : "neutral", heard: null, diffs: [] }));
  if (partial) slots.forEach((expIndex, s) => { if (s > lastPaired) words[expIndex].status = "pending"; });
  slots.forEach((expIndex, s) => {
    if (pairs[s] < 0) return;
    const heardIndex = heardSlots[pairs[s]];
    usedHeard.add(heardIndex);
    const { diffs, unclear } = compareWordMarks(expectedWords[expIndex], heardWords[heardIndex], { ignoreLast: expIndex === lastSlot });
    const w = words[expIndex];
    w.heard = heardWords[heardIndex];
    w.diffs = diffs;
    w.status = diffs.length ? "harakat" : unclear ? "unclear" : "ok";
  });

  const extra = heardWords.filter((_, i) => heardKeys[i] && !usedHeard.has(i));
  const real = words.filter((w) => w.status !== "neutral");
  const count = (st) => real.filter((w) => w.status === st).length;
  const ok = count("ok");
  const wrong = count("harakat");
  const summary = {
    words: real.length,
    ok,
    wrong,
    unclear: count("unclear"),
    notHeard: count("notheard"),
    pending: count("pending"),
    score: ok + wrong > 0 ? Math.round((ok / (ok + wrong)) * 100) : null,
  };
  return { available: true, partial, reason: null, coverage, words, extra, summary };
}

// Most Quran texts put the Bismillah at the start of Ayah 1 (except Al-Fatihah, where it IS Ayah 1).
function stripBismillah(text, surahNumber, ayahNumber) {
  if (surahNumber === 1 || ayahNumber !== 1) return text;
  const words = String(text || "").trim().split(/\s+/);
  const first4 = words.slice(0, 4).map(wordKey).join(" ");
  return first4 === "\u0628\u0633\u0645 \u0644\u0644\u0647 \u0644\u0631\u062D\u0645\u0646 \u0644\u0631\u062D\u064A\u0645" ? words.slice(4).join(" ") : text;
}

module.exports = { parseUnits, wordKey, compareWordMarks, markCoverage, checkHarakat, stripBismillah, MIN_COVERAGE };
