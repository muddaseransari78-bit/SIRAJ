import test from "node:test";
import assert from "node:assert";
import { parseTajweed, stripTajweed, TAJWEED_RULES } from "./tajweed.js";

test("splits marked and plain text", () => {
  const parts = parseTajweed("بِسْمِ [h:1[ٱ]للَّهِ");
  assert.strictEqual(parts.length, 3);
  assert.strictEqual(parts[1].text, "ٱ");
  assert.strictEqual(parts[1].rule.code, "h");
  assert.strictEqual(parts[0].rule, null);
});

test("works without the numeric id", () => {
  const parts = parseTajweed("ab[n[c]d");
  assert.deepStrictEqual(parts.map((p) => p.text), ["ab", "c", "d"]);
  assert.strictEqual(parts[1].rule.code, "n");
});

test("unknown rule letters stay as plain text", () => {
  const parts = parseTajweed("x[z[y]w");
  assert.strictEqual(parts.map((p) => p.text).join(""), "xyw");
  assert.ok(parts.every((p) => p.rule === null));
});

test("text without marks is returned unchanged", () => {
  assert.strictEqual(stripTajweed("الحمد لله"), "الحمد لله");
});

test("stray brackets are removed instead of shown", () => {
  assert.strictEqual(stripTajweed("ab[cd"), "abcd");
});

test("empty input gives no pieces", () => {
  assert.deepStrictEqual(parseTajweed(""), []);
  assert.deepStrictEqual(parseTajweed(null), []);
});

test("every rule has a unique code and css class", () => {
  assert.strictEqual(new Set(TAJWEED_RULES.map((r) => r.code)).size, TAJWEED_RULES.length);
  assert.strictEqual(new Set(TAJWEED_RULES.map((r) => r.cls)).size, TAJWEED_RULES.length);
});
