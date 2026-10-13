// Decides which zabar / zer / pesh mistakes found DURING the recitation are sure enough to sound the alarm.
//
// Every ~1.5 s the server re-listens to the audio so far. Between two answers the model can change its mind about a
// vowel (it hears more audio each time). So a vowel mistake only counts once TWO answers in a row show the SAME mistake
// on the same word. One-off flickers never beep. Words are numbered like the Ayah on screen (index in the Ayah's words).
// No React, no sound here: it is tested with plain Node.

/** A short text that identifies a word's mistake, e.g. "vowel:د:damma>fatha". "" when the word has no mistake. */
export function diffSignature(word) {
  if (!word || word.status !== "harakat" || !Array.isArray(word.diffs) || !word.diffs.length) return "";
  return word.diffs.map((d) => `${d.kind}:${d.letter}:${d.expected}>${d.heard || "-"}`).join("|");
}

/** Map wordIndex -> signature for every word with a harakat mistake in one live result. */
export function mistakeMap(result) {
  const out = {};
  if (!result || !result.available || !Array.isArray(result.words)) return out;
  result.words.forEach((w, i) => { const sig = diffSignature(w); if (sig) out[i] = sig; });
  return out;
}

/**
 * previous: the mistakeMap of the answer before (or {}), result: the new live answer, alerted: Set of word indexes that already beeped.
 * Returns { fire: [wordIndex...], map }  - keep `map` as `previous` for the next call.
 */
export function confirmMistakes(previous, result, alerted) {
  const map = mistakeMap(result);
  const fire = Object.keys(map).map(Number).filter((i) => previous && previous[i] === map[i] && !alerted.has(i));
  return { fire, map };
}
