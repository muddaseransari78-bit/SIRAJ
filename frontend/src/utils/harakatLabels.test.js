import test from "node:test";
import assert from "node:assert";
import { describeDiff, summaryLine } from "./harakatLabels.js";

test("describes a vowel difference", () => {
  assert.strictEqual(describeDiff({ letter: "د", kind: "vowel", expected: "damma", heard: "fatha" }), "on د: expected pesh (damma), heard zabar (fatha)");
});

test("describes a missing shadda", () => {
  assert.strictEqual(describeDiff({ letter: "ل", kind: "shadda", expected: "shadda", heard: null }), "on ل: shadda (tashdeed) is missing");
});

test("never reports success when the model gave no harakat", () => {
  assert.match(summaryLine({ available: false, reason: "no-harakat" }), /Could not check/);
});

test("summarises counts", () => {
  assert.match(summaryLine({ available: true, summary: { ok: 4, wrong: 0 } }), /No zabar\/zer\/pesh difference found in 4 words/);
  assert.match(summaryLine({ available: true, summary: { ok: 3, wrong: 1 } }), /1 word with a different/);
});

test("mentions words that were not heard instead of reporting plain success", () => {
  assert.match(summaryLine({ available: true, summary: { ok: 3, wrong: 0, notHeard: 1 } }), /No zabar\/zer\/pesh difference found in 3 words\. 1 word was not heard\./);
});
