// Phase 22 - small date and text helpers.
import test from "node:test";
import assert from "node:assert";
import { localDate, localDateDMY, formatDMY, addDays } from "./date.js";
import { plain } from "./text.js";

test("localDate uses the LOCAL calendar day, zero-padded", () => {
  assert.strictEqual(localDate(new Date(2026, 0, 5, 23, 59)), "2026-01-05");
  assert.strictEqual(localDate(new Date(2026, 11, 31, 0, 1)), "2026-12-31");
});

test("localDateDMY is the same day as DD-MM-YYYY", () => {
  assert.strictEqual(localDateDMY(new Date(2026, 9, 4)), "04-10-2026");
});

test("formatDMY writes a short date, with or without weekday, and survives bad input", () => {
  assert.strictEqual(formatDMY("08-02-2027"), "8 Feb 2027");
  assert.match(formatDMY("08-02-2027", true), /Mon/);
  assert.strictEqual(formatDMY("garbage"), "garbage");
  assert.strictEqual(formatDMY(""), "");
});

test("addDays moves forward and backward over month ends without changing the original", () => {
  const start = new Date(2026, 0, 31);
  assert.strictEqual(localDate(addDays(start, 1)), "2026-02-01");
  assert.strictEqual(localDate(addDays(start, -31)), "2025-12-31");
  assert.strictEqual(localDate(start), "2026-01-31");
});

test("plain(): prefers text, strips HTML from body, handles empty", () => {
  assert.strictEqual(plain({ text: "Hello", body: "<b>x</b>" }), "Hello");
  assert.strictEqual(plain({ body: "<p>Patience   is <b>light</b></p>" }), "Patience is light");
  assert.strictEqual(plain(null), "");
  assert.strictEqual(plain({}), "");
});
