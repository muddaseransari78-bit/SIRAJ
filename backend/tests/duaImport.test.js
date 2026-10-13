// Phase 25 - Duas in our own database: conversion rules and the starter data. No database or network needed.
const test = require("node:test");
const assert = require("node:assert");
const { textOf, starterToDoc, externalToDoc, duaSlug, toApiShape } = require("../utils/duaImport");
const { STARTER_DUAS } = require("../data/starterDuas");

test("textOf: strings, {text}/{en} objects, html and empty values", () => {
  assert.equal(textOf("  hello  "), "hello");
  assert.equal(textOf({ text: "a" }), "a");
  assert.equal(textOf({ en: "b" }), "b");
  assert.equal(textOf("<p>Hi <b>there</b></p>"), "Hi there");
  assert.equal(textOf(null), "");
  assert.equal(textOf({}), "");
});

test("starter Duas: every one is complete, has a Quran reference, and keys are unique", () => {
  assert.ok(STARTER_DUAS.length >= 10);
  const keys = new Set();
  for (const d of STARTER_DUAS) {
    const doc = starterToDoc(d);
    assert.ok(doc, `incomplete starter dua: ${d.key}`);
    assert.match(d.source, /^Quran \d{1,3}:\d{1,3}/, `${d.key} must cite Surah:Ayah`);
    assert.match(d.arabic, /[\u0600-\u06FF]/);
    assert.ok(d.english && d.urdu, `${d.key} needs English and Urdu`);
    assert.equal(doc.origin, "starter");
    keys.add(doc.externalKey);
  }
  assert.equal(keys.size, STARTER_DUAS.length);
});

test("starter key matches the cited Surah:Ayah", () => {
  for (const d of STARTER_DUAS) {
    const [, s, a] = d.key.match(/^quran-(\d+)-(\d+)$/) || [];
    assert.ok(s, `bad key ${d.key}`);
    assert.ok(d.source.startsWith(`Quran ${s}:${a}`), `${d.key} vs ${d.source}`);
  }
});

test("starterToDoc rejects incomplete items", () => {
  assert.equal(starterToDoc({ key: "x", category: "general", arabic: "", source: "s" }), null);
  assert.equal(starterToDoc({ key: "x", category: "general", arabic: "ا", source: "" }), null);
  assert.equal(starterToDoc({ key: "x", category: "Bad Category!", arabic: "ا", source: "s" }), null);
  assert.equal(starterToDoc(null), null);
});

test("externalToDoc: keeps the source and slug, strips html", () => {
  const doc = externalToDoc("morning", {
    slug: "abc", ar: { text: "<span>الحمد لله</span>" }, en: { text: "Praise" },
    transliteration: { en: "Alhamdulillah" }, ur: { text: "حمد" }, source: { en: "Hisn al-Muslim 12" },
  }, 0);
  assert.equal(doc.externalKey, "hisn:morning:abc");
  assert.equal(doc.externalSlug, "abc");
  assert.equal(doc.arabic, "الحمد لله");
  assert.equal(doc.source, "Hisn al-Muslim 12");
  assert.equal(doc.origin, "import");
});

test("externalToDoc: NO source or NO Arabic = skipped (never store a Dua without its source)", () => {
  assert.equal(externalToDoc("morning", { slug: "a", ar: { text: "ا" }, en: { text: "x" } }), null);
  assert.equal(externalToDoc("morning", { slug: "a", ar: { text: "" }, source: { en: "s" } }), null);
  assert.equal(externalToDoc("Bad Cat", { ar: "ا", source: "s" }), null);
  assert.equal(externalToDoc("morning", null), null);
});

test("externalToDoc: missing slug falls back to category-number", () => {
  assert.equal(externalToDoc("travel", { ar: "ا", source: "s" }, 2).externalSlug, "travel-3");
});

test("API shape: admin rows are 'custom', imported rows are not; slugs stay stable", () => {
  const admin = toApiShape({ _id: "507f1f77bcf86cd799439011", arabic: "ا", english: "e", source: "s" });
  assert.equal(admin.slug, "custom-507f1f77bcf86cd799439011");
  assert.equal(admin.custom, true);
  const imported = toApiShape({ _id: "1", externalSlug: "abc", origin: "import", arabic: "ا", source: "s" });
  assert.equal(imported.slug, "abc");
  assert.equal(imported.custom, false);
  const starter = toApiShape({ _id: "2", externalSlug: "starter-quran-2-201", origin: "starter", arabic: "ا", source: "s" });
  assert.equal(starter.custom, true);
  assert.equal(duaSlug({ _id: "3" }), "custom-3");
});
