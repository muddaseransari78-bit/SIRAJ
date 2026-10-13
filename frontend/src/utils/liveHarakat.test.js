import test from "node:test";
import assert from "node:assert";
import { diffSignature, mistakeMap, confirmMistakes } from "./liveHarakat.js";

const bad = (letter = "د", expected = "damma", heard = "fatha") => ({ word: "x", status: "harakat", diffs: [{ kind: "vowel", letter, expected, heard }] });
const ok = { word: "y", status: "ok", diffs: [] };
const pending = { word: "z", status: "pending", diffs: [] };
const result = (...words) => ({ available: true, words });

test("a word without a harakat mistake has an empty signature", () => {
  assert.strictEqual(diffSignature(ok), "");
  assert.strictEqual(diffSignature(pending), "");
  assert.strictEqual(diffSignature(null), "");
  assert.strictEqual(diffSignature(bad()), "vowel:د:damma>fatha");
});

test("mistakeMap lists only wrong words, by their position", () => {
  assert.deepStrictEqual(mistakeMap(result(ok, bad(), pending)), { 1: "vowel:د:damma>fatha" });
  assert.deepStrictEqual(mistakeMap({ available: false }), {});
  assert.deepStrictEqual(mistakeMap(null), {});
});

test("the first answer never beeps (it must be confirmed by a second one)", () => {
  const r = confirmMistakes({}, result(bad(), ok), new Set());
  assert.deepStrictEqual(r.fire, []);
});

test("the same mistake twice in a row beeps", () => {
  const first = confirmMistakes({}, result(bad(), ok), new Set());
  const second = confirmMistakes(first.map, result(bad(), ok, pending), new Set());
  assert.deepStrictEqual(second.fire, [0]);
});

test("a flicker (mistake, then fine) never beeps", () => {
  const first = confirmMistakes({}, result(bad(), ok), new Set());
  const second = confirmMistakes(first.map, result(ok, ok), new Set());
  assert.deepStrictEqual(second.fire, []);
});

test("a changed mistake restarts the count", () => {
  const first = confirmMistakes({}, result(bad("د", "damma", "fatha")), new Set());
  const second = confirmMistakes(first.map, result(bad("د", "damma", "kasra")), new Set());
  assert.deepStrictEqual(second.fire, []);
});

test("one beep per word: an already alerted word stays quiet", () => {
  const first = confirmMistakes({}, result(bad()), new Set());
  const second = confirmMistakes(first.map, result(bad()), new Set([0]));
  assert.deepStrictEqual(second.fire, []);
});
