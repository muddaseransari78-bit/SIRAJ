// Decides WHEN the "mistake" alert sound should play during live recitation.
//
// Why not play the sound the moment a word turns red?
// While you are still saying a word, the browser sends half-words ("ال", then "الح", then "الحمد").
// A half-word looks like a "different word" for a moment. If we beeped at once, you would hear false alarms
// on every long word. So a mistake must stay the same for a very short time (SETTLE_*_MS) before it beeps.
// This file has no React and no sound in it, so it can be tested with plain Node.

export const SETTLE_WRONG_MS = 500; // a "different word" must stay unchanged this long (the recogniser stopped changing it)
export const SETTLE_MISSED_MS = 150; // a skipped word is only known after a LATER word matched, so it is already settled

/** Every word of the live result that is a mistake right now. kind: "wrong" (loud alarm) | "close" (soft tick) */
export function currentMistakes(live) {
  if (!live || !Array.isArray(live.words)) return [];
  const out = [];
  live.words.forEach((w, index) => {
    if (w.status === "different") out.push({ index, kind: "wrong", key: `d:${w.heard || ""}`, settle: SETTLE_WRONG_MS });
    else if (w.status === "missed") out.push({ index, kind: "wrong", key: "m", settle: SETTLE_MISSED_MS });
    else if (w.status === "close") out.push({ index, kind: "close", key: `c:${w.heard || ""}`, settle: SETTLE_WRONG_MS });
  });
  return out;
}

/**
 * live:     result of alignLive()
 * pending:  { [wordIndex]: { key, since } }  - mistakes seen before but not yet beeped
 * alerted:  Set of word indexes that already beeped (one beep per word, per Ayah attempt)
 * now:      Date.now()
 * Returns { fire, pending, wait }
 *   fire:    mistakes that must beep now
 *   pending: the new pending map (keep it for the next call)
 *   wait:    milliseconds until the next check is needed, or null when nothing is waiting
 */
export function evaluate(live, pending, alerted, now) {
  const nextPending = {};
  const fire = [];
  let wait = null;
  currentMistakes(live).forEach((m) => {
    if (alerted.has(m.index)) return;
    const old = pending[m.index];
    const since = old && old.key === m.key ? old.since : now; // the heard text changed -> start counting again
    const left = since + m.settle - now;
    if (left <= 0) {
      fire.push(m);
    } else {
      nextPending[m.index] = { key: m.key, since };
      wait = wait === null ? left : Math.min(wait, left);
    }
  });
  return { fire, pending: nextPending, wait };
}
