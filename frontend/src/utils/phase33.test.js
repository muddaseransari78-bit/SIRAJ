// Phase 33 - the language switcher now covers every page. Some keys are built at run time
// (t(`topic.${slug}`) ...), so the normal "every t('literal') exists" test cannot see them.
// This test checks that each run-time family is complete, and that Urdu/Arabic really are in Arabic script.
import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ENTRIES, translations } from "../i18n/translations.js";
import { DHIKR } from "./tasbeeh.js";

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const has = (key) => Object.prototype.hasOwnProperty.call(translations.en, key);
const ARABIC_SCRIPT = /[\u0600-\u06FF]/;

const families = {
  "pn.": ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"],
  "hm.": Array.from({ length: 12 }, (_, i) => String(i + 1)),
  "goals.label.": ["TASBEEH_DAILY", "PRAYERS_DAILY", "READING_DAYS_WEEKLY"],
  "goals.hint.": ["TASBEEH_DAILY", "PRAYERS_DAILY", "READING_DAYS_WEEKLY"],
  "method.": ["1", "2", "3", "4", "5", "8", "11", "13", "15"],
  "dir.": ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"],
  "city.": ["Lahore", "Karachi", "Islamabad", "London", "New York", "Dubai"],
  "saved.type.": ["AYAH", "SURAH", "HADITH", "DUA"],
  "rev.": ["Meccan", "Medinan"],
  "mark.": ["fatha", "damma", "kasra", "sukun", "fathatan", "dammatan", "kasratan", "shadda", "none"],
  "duas.cat.": ["morning", "evening", "after-prayer", "before-sleep", "waking-up", "prayer", "mosque", "travel", "food", "home", "anxiety", "protection", "forgiveness", "hajj"],
  "topic.": ["patience", "gratitude", "forgiveness", "repentance", "trust-in-allah", "prayer", "charity", "parents", "justice", "knowledge", "death-afterlife", "family"],
  "dhikr.": DHIKR.map((d) => d.id),
};

test("every run-time key family is complete", () => {
  for (const [prefix, names] of Object.entries(families)) {
    for (const n of names) assert.ok(has(prefix + n), `missing key ${prefix}${n}`);
  }
});

test("Urdu and Arabic texts are written in Arabic script (not left in English)", () => {
  const allowedEnglish = new Set(["tasbeeh.ownPh", "search.pagePh", "assistant.placeholder"]);
  const short = (k) => /^(mark|dir|city|rev|pn|hm|method)\./.test(k);
  for (const [key, [en, ur, ar]] of Object.entries(ENTRIES)) {
    if (allowedEnglish.has(key) || short(key)) continue;
    if (!/[A-Za-z]{4}/.test(en)) continue; // symbols/numbers only
    assert.ok(ARABIC_SCRIPT.test(ur), `Urdu text missing for ${key}`);
    assert.ok(ARABIC_SCRIPT.test(ar), `Arabic text missing for ${key}`);
  }
});

test("event names from the server all have a translation key", () => {
  const src = fs.readFileSync(path.join(SRC, "utils", "hijriText.js"), "utf8");
  const keys = [...src.matchAll(/"((?:ev|evn)\.[A-Za-z0-9]+)"/g)].map((m) => m[1]);
  assert.ok(keys.length >= 15);
  for (const k of keys) assert.ok(has(k), `missing ${k}`);
});

test("only /admin is still English-only", () => {
  const app = fs.readFileSync(path.join(SRC, "App.jsx"), "utf8");
  assert.ok(app.includes('path="/admin"') && app.includes('dir="ltr"'));
  const layout = fs.readFileSync(path.join(SRC, "layouts", "MainLayout.jsx"), "utf8");
  assert.ok(layout.includes("NOT_TRANSLATED = []"));
});

test("every file that calls useI18n() imports it (a missing import crashes the whole page)", () => {
  const bad = [];
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) { walk(full); continue; }
      if (!/\.(jsx|js)$/.test(name) || /\.test\.js$/.test(name)) continue;
      const code = fs.readFileSync(full, "utf8");
      if (/=\s*useI18n\(\)/.test(code) && !/import\s*\{[^}]*useI18n[^}]*\}\s*from/.test(code) && !/export function useI18n/.test(code)) bad.push(path.relative(SRC, full));
    }
  };
  walk(SRC);
  assert.deepEqual(bad, []);
});
