// Phase 22 - the interface text must be complete in English, Urdu and Arabic,
// and every t("key") written in the code must really exist.
import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ENTRIES, LANGUAGES, translations } from "../i18n/translations.js";

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, out);
    else if (/\.(jsx?|mjs)$/.test(name) && !/\.test\.js$/.test(name)) out.push(full);
  }
  return out;
}
const placeholders = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");

test("three languages are declared, Urdu and Arabic are right-to-left", () => {
  assert.deepStrictEqual(LANGUAGES.map((l) => l.code), ["en", "ur", "ar"]);
  assert.strictEqual(LANGUAGES.find((l) => l.code === "en").dir, "ltr");
  assert.strictEqual(LANGUAGES.find((l) => l.code === "ur").dir, "rtl");
  assert.strictEqual(LANGUAGES.find((l) => l.code === "ar").dir, "rtl");
});

test("every key has exactly 3 non-empty texts (English, Urdu, Arabic)", () => {
  const bad = [];
  for (const [key, v] of Object.entries(ENTRIES)) {
    if (!Array.isArray(v) || v.length !== 3 || v.some((x) => typeof x !== "string" || !x.trim())) bad.push(key);
  }
  assert.deepStrictEqual(bad, []);
});

test("Urdu and Arabic texts really are in Arabic script (not copied English)", () => {
  const arabicScript = /[\u0600-\u06FF]/;
  const offenders = Object.entries(ENTRIES)
    .filter(([, v]) => !arabicScript.test(v[1]) || !arabicScript.test(v[2]))
    .map(([key]) => key);
  assert.deepStrictEqual(offenders, []);
});

test("placeholders like {n} are the same in all three languages", () => {
  const bad = Object.entries(ENTRIES).filter(([, v]) => !(placeholders(v[0]) === placeholders(v[1]) && placeholders(v[1]) === placeholders(v[2])));
  assert.deepStrictEqual(bad.map(([k]) => k), []);
});

test("built dictionaries have the same keys in each language", () => {
  const n = Object.keys(translations.en).length;
  assert.strictEqual(Object.keys(translations.ur).length, n);
  assert.strictEqual(Object.keys(translations.ar).length, n);
  assert.ok(n > 100);
});

test("every t(\"literal.key\") used in the code exists in the dictionary", () => {
  const missing = new Map();
  const re = /\bt\(\s*["'`]([A-Za-z0-9_.\-]+)["'`]/g;
  for (const file of walk(SRC)) {
    // comments (which show example keys like t("key")) are removed first
    const text = fs.readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    for (const m of text.matchAll(re)) {
      if (!(m[1] in ENTRIES)) missing.set(m[1], path.relative(SRC, file));
    }
  }
  assert.deepStrictEqual([...missing.entries()], []);
});
