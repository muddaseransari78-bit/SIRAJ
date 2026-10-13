// Phase 30 - audio player helpers, Mushaf helpers and the feedback form rules.
import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  uniqueSurahs, chunk, buildSurahTracks, buildRangeTracks, findTrackIndex, formatTime, nextRepeat, afterEnded, ayahKey, SPEEDS,
} from "./audioTracks.js";
import { splitBismillah, hasBismillahLine, groupBySurah, toArabicDigits, BISMILLAH } from "./mushaf.js";
import { emptyForm, validateForm, buildPayload, toggleItem, safeReturnPath, FEATURE_OPTIONS, FEEDBACK_TYPES, RECOMMEND_OPTIONS } from "./feedbackForm.js";
import { ENTRIES } from "../i18n/translations.js";

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(SRC, rel), "utf8");

// ---------- audio ----------
const ayahs = [
  { surahNumber: 2, numberInSurah: 285 }, { surahNumber: 2, numberInSurah: 286 },
  { surahNumber: 3, numberInSurah: 1 }, { surahNumber: 3, numberInSurah: 2 },
];
const audio2 = [{ numberInSurah: 285, audio: "a285" }, { numberInSurah: 286, audio: "a286" }];
const audio3 = [{ numberInSurah: 1, audio: "b1" }, { numberInSurah: 2, audio: "" }];

test("audio: uniqueSurahs keeps reading order without repeats", () => {
  assert.deepStrictEqual(uniqueSurahs(ayahs), [2, 3]);
  assert.deepStrictEqual(uniqueSurahs([]), []);
  assert.deepStrictEqual(uniqueSurahs(null), []);
});

test("audio: chunk splits a list into groups", () => {
  assert.deepStrictEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepStrictEqual(chunk([], 3), []);
  assert.deepStrictEqual(chunk([1, 2], 0), [[1], [2]]);
});

test("audio: a Surah list becomes tracks and skips Ayahs without a file", () => {
  assert.deepStrictEqual(buildSurahTracks(3, audio3), [{ surahNumber: 3, numberInSurah: 1, audio: "b1" }]);
  assert.deepStrictEqual(buildSurahTracks(3, null), []);
});

test("audio: a Juz/Page list follows the reading order across Surahs", () => {
  const tracks = buildRangeTracks(ayahs, { 2: audio2, 3: audio3 });
  assert.deepStrictEqual(tracks.map((t) => ayahKey(t.surahNumber, t.numberInSurah)), ["2:285", "2:286", "3:1"]);
  assert.strictEqual(tracks[2].audio, "b1");
});

test("audio: if one Surah failed to load the others still play", () => {
  const tracks = buildRangeTracks(ayahs, { 3: audio3 });
  assert.deepStrictEqual(tracks.map((t) => t.audio), ["b1"]);
  assert.deepStrictEqual(buildRangeTracks(ayahs, {}), []);
});

test("audio: findTrackIndex needs Surah AND Ayah", () => {
  const tracks = buildRangeTracks(ayahs, { 2: audio2, 3: audio3 });
  assert.strictEqual(findTrackIndex(tracks, 3, 1), 2);
  assert.strictEqual(findTrackIndex(tracks, 3, 285), -1);
  assert.strictEqual(findTrackIndex(tracks, 2, 286), 1);
});

test("audio: time text, speeds and repeat cycle", () => {
  assert.strictEqual(formatTime(75), "1:15");
  assert.strictEqual(formatTime(5.9), "0:05");
  for (const bad of [NaN, Infinity, -4, undefined, null]) assert.strictEqual(formatTime(bad), "0:00");
  assert.ok(SPEEDS.includes(1) && SPEEDS.every((s) => s > 0));
  assert.deepStrictEqual(["off", "ayah", "all"].map(nextRepeat), ["ayah", "all", "off"]);
});

test("audio: what happens when an Ayah ends", () => {
  assert.strictEqual(afterEnded("ayah", 0, 5), "replay");
  assert.strictEqual(afterEnded("ayah", 4, 5), "replay");
  assert.strictEqual(afterEnded("off", 0, 5), "next");
  assert.strictEqual(afterEnded("off", 4, 5), "stop");
  assert.strictEqual(afterEnded("all", 4, 5), "restart");
  assert.strictEqual(afterEnded("all", 0, 0), "stop");
});

// ---------- Mushaf ----------
test("mushaf: Bismillah in front of Ayah 1 is split off", () => {
  const r = splitBismillah("بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ الٓمٓ");
  assert.strictEqual(r.rest, "الٓمٓ");
  assert.ok(r.bismillah && r.bismillah.split(" ").length === 4);
});

test("mushaf: text without the Bismillah is returned unchanged", () => {
  const t = "ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَـٰلَمِينَ";
  assert.deepStrictEqual(splitBismillah(t), { bismillah: null, rest: t });
  assert.deepStrictEqual(splitBismillah(""), { bismillah: null, rest: "" });
  // only the Bismillah itself (like Al-Fatiha Ayah 1) is never split
  assert.strictEqual(splitBismillah(BISMILLAH).bismillah, null);
});

test("mushaf: Al-Fatiha and At-Tawbah have no separate Bismillah line", () => {
  assert.strictEqual(hasBismillahLine(1), false);
  assert.strictEqual(hasBismillahLine(9), false);
  assert.strictEqual(hasBismillahLine(2), true);
  assert.strictEqual(hasBismillahLine(114), true);
});

test("mushaf: groups by Surah and Arabic digits", () => {
  const g = groupBySurah([
    { surahNumber: 1, surahName: "a", surahEnglishName: "A" }, { surahNumber: 1 },
    { surahNumber: 2, surahName: "b", surahEnglishName: "B" },
  ]);
  assert.deepStrictEqual(g.map((x) => [x.surahNumber, x.items.length]), [[1, 2], [2, 1]]);
  assert.strictEqual(toArabicDigits(286), "٢٨٦");
  assert.deepStrictEqual(groupBySurah(null), []);
});

// ---------- feedback form ----------
test("feedback form: needs an overall rating and a recommend answer", () => {
  const f = emptyForm();
  assert.strictEqual(validateForm(f), "feedback.err.overall");
  f.ratings.overall = 4;
  assert.strictEqual(validateForm(f), "feedback.err.recommend");
  f.recommend = "yes";
  assert.strictEqual(validateForm(f), null);
});

test("feedback form: bug / content reports need a description", () => {
  const f = { ...emptyForm(), ratings: { overall: 2, ease: 0, quran: 0, audio: 0 }, recommend: "maybe", type: "bug" };
  assert.strictEqual(validateForm(f), "feedback.err.describe");
  f.improve = "Audio stops after ayah 5";
  assert.strictEqual(validateForm(f), null);
  f.improve = "x".repeat(1001);
  assert.strictEqual(validateForm(f), "feedback.err.tooLong");
});

test("feedback form: payload leaves out ratings that were not given", () => {
  const f = emptyForm();
  f.ratings = { overall: 5, ease: 0, quran: 4, audio: 0 };
  f.recommend = "yes"; f.improve = "  more reciters  ";
  assert.deepStrictEqual(buildPayload(f), { type: "general", ratings: { overall: 5, quran: 4 }, features: [], recommend: "yes", improve: "more reciters", newFeature: "" });
});

test("feedback form: toggleItem and the feature list match the server", () => {
  assert.deepStrictEqual(toggleItem(["a"], "b"), ["a", "b"]);
  assert.deepStrictEqual(toggleItem(["a", "b"], "a"), ["b"]);
  const server = fs.readFileSync(path.resolve(SRC, "../../backend/utils/feedbackValidate.js"), "utf8");
  const list = server.match(/const FEATURES = \[([\s\S]*?)\];/)[1].match(/"(\w+)"/g).map((s) => s.replace(/"/g, ""));
  assert.deepStrictEqual(FEATURE_OPTIONS.map(([id]) => id).sort(), [...list].sort());
});

test("feedback form: only in-app paths are used to return after login", () => {
  assert.strictEqual(safeReturnPath("/feedback"), "/feedback");
  for (const bad of ["https://evil.com", "//evil.com", "javascript:alert(1)", "/\\evil", undefined, null, 5]) {
    assert.strictEqual(safeReturnPath(bad), "/dashboard", String(bad));
  }
  assert.strictEqual(safeReturnPath("nope", "/x"), "/x");
});

// ---------- wiring (static checks) ----------
test("navbar links the five new pages and the pages exist in the router", () => {
  const nav = read("components/Navbar.jsx");
  const app = read("App.jsx");
  for (const to of ["/ramadan", "/calendar", "/topics", "/assistant", "/feedback"]) {
    assert.ok(nav.includes(`to: "${to}"`), `Navbar is missing ${to}`);
    assert.ok(app.includes(`path="${to}"`), `App.jsx is missing the route ${to}`);
  }
});

test("every Quran view has the audio player and the Mushaf toggle", () => {
  for (const f of ["pages/quran/SurahReader.jsx", "pages/quran/QuranRange.jsx"]) {
    const s = read(f);
    assert.ok(s.includes("<AudioPlayer"), `${f}: no audio player`);
    assert.ok(s.includes("<ViewModeToggle"), `${f}: no Mushaf toggle`);
    assert.ok(s.includes("<MushafText"), `${f}: no Mushaf text`);
  }
});

test("new text keys exist in all three languages", () => {
  for (const key of ["nav.ramadan", "nav.topics", "nav.sourceFinder", "nav.feedback", "feedback.title", "feedback.loginNeeded", "audio.speed", "reader.openWithAudio", "home.explore.title"]) {
    assert.ok(Array.isArray(ENTRIES[key]) && ENTRIES[key].length === 3, key);
  }
});

test("dynamic text keys used by the feedback form and the navbar exist in all languages", () => {
  const keys = [
    ...FEEDBACK_TYPES.map((x) => `feedback.type.${x}`),
    ...RECOMMEND_OPTIONS.map((x) => `feedback.recommend.${x}`),
    ...FEATURE_OPTIONS.map(([, k]) => k),
    "feedback.err.overall", "feedback.err.recommend", "feedback.err.describe", "feedback.err.tooLong",
  ];
  const nav = read("components/Navbar.jsx");
  for (const m of nav.matchAll(/label: "([\w.]+)"/g)) keys.push(m[1]);
  const home = read("pages/public/Home.jsx");
  for (const m of home.matchAll(/(?:title|desc): "([\w.]+)"/g)) keys.push(m[1]);
  const missing = keys.filter((k) => !(Array.isArray(ENTRIES[k]) && ENTRIES[k].length === 3));
  assert.deepStrictEqual(missing, []);
});

test("the range audio note keeps its {label} placeholder in every language", () => {
  for (const text of ENTRIES["range.audioNote"]) assert.match(text, /\{label\}/);
});
