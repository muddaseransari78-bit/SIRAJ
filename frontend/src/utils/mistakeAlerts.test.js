import test from "node:test";
import assert from "node:assert";
import { alignLive } from "./liveRecitation.js";
import { splitWords } from "./recitationMatch.js";
import { currentMistakes, evaluate, SETTLE_WRONG_MS } from "./mistakeAlerts.js";

const ayah = "ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَـٰلَمِينَ";
const say = (text) => alignLive(ayah, splitWords(text));

test("a correct recitation has no mistakes", () => {
  assert.deepStrictEqual(currentMistakes(say("الحمد لله رب العالمين")), []);
  assert.deepStrictEqual(currentMistakes(null), []);
});

test("a different word and a skipped word are both loud mistakes", () => {
  const wrong = currentMistakes(say("الحمد لنا"));
  assert.strictEqual(wrong.length, 1);
  assert.strictEqual(wrong[0].kind, "wrong");
  assert.strictEqual(wrong[0].index, 1);
  const skipped = currentMistakes(say("الحمد رب العالمين"));
  assert.strictEqual(skipped[0].kind, "wrong");
  assert.strictEqual(skipped[0].index, 1);
});

test("a different word does not beep at once - it must stay unchanged for a moment", () => {
  const live = say("الحمد لنا");
  const first = evaluate(live, {}, new Set(), 1000);
  assert.strictEqual(first.fire.length, 0);
  assert.strictEqual(first.wait, SETTLE_WRONG_MS);
  const later = evaluate(live, first.pending, new Set(), 1000 + SETTLE_WRONG_MS);
  assert.strictEqual(later.fire.length, 1);
  assert.strictEqual(later.fire[0].index, 1);
});

test("a half-word that keeps changing never beeps (the timer starts again)", () => {
  let pending = {};
  let t = 1000;
  for (const part of ["لن", "لنا", "لناس"]) {
    const r = evaluate(say(`الحمد ${part}`), pending, new Set(), t);
    assert.strictEqual(r.fire.length, 0);
    pending = r.pending;
    t += 300; // changes before 500 ms are over
  }
});

test("a word that is corrected before the beep never beeps", () => {
  const first = evaluate(say("الحمد لنا"), {}, new Set(), 0);
  const fixed = evaluate(say("الحمد لنا لله"), first.pending, new Set(), 600);
  assert.strictEqual(fixed.fire.length, 0); // the word was said again, correctly
  assert.deepStrictEqual(fixed.pending, {});
});

test("one beep per word: an already alerted word stays quiet", () => {
  const live = say("الحمد رب العالمين");
  const r = evaluate(live, {}, new Set([1]), 5000);
  assert.strictEqual(r.fire.length, 0);
  assert.strictEqual(r.wait, null);
});

test("a skipped word beeps almost at once", () => {
  const live = say("الحمد رب العالمين");
  const r = evaluate(live, {}, new Set(), 0);
  assert.strictEqual(r.fire.length, 0);
  assert.ok(r.wait <= 150);
  assert.strictEqual(evaluate(live, r.pending, new Set(), 150).fire.length, 1);
});
