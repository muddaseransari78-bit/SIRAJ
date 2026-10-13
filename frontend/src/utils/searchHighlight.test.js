import test from "node:test";
import assert from "node:assert";
import { splitHighlight, buildHighlightRegex, stripTags } from "./searchHighlight.js";

const joined = (parts) => parts.map((p) => p.text).join("");
const hits = (parts) => parts.filter((p) => p.hit).map((p) => p.text);

test("highlights a word without changing the text", () => {
  const parts = splitHighlight("Allah is with the Patient", "patient");
  assert.deepStrictEqual(hits(parts), ["Patient"]);
  assert.strictEqual(joined(parts), "Allah is with the Patient");
});

test("highlights every typed word", () => {
  assert.deepStrictEqual(hits(splitHighlight("Be patient and grateful", "patient grateful")), ["patient", "grateful"]);
});

test("Arabic: harakat and alef variants do not stop a match", () => {
  const text = "ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَـٰلَمِينَ";
  const parts = splitHighlight(text, "الحمد");
  assert.strictEqual(joined(parts), text);
  assert.strictEqual(hits(parts).length, 1);
  assert.ok(hits(parts)[0].includes("حَمْدُ"));
});

test("no query, one-letter latin word, or no match leaves the text alone", () => {
  assert.deepStrictEqual(splitHighlight("hello", ""), [{ text: "hello", hit: false }]);
  assert.strictEqual(buildHighlightRegex("a"), null);
  assert.deepStrictEqual(hits(splitHighlight("hello", "xyz")), []);
});

test("special characters in the query are safe", () => {
  assert.doesNotThrow(() => splitHighlight("a (b) c", "(b)"));
  assert.deepStrictEqual(hits(splitHighlight("a (b) c", "(b)")), ["(b)"]);
  assert.doesNotThrow(() => splitHighlight("text", "[[[ ***"));
});

test("stripTags removes html", () => {
  assert.strictEqual(stripTags("a <b>bold</b> word"), "a bold word");
});
