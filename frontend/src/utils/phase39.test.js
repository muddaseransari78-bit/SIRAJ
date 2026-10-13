// Phase 39 - smooth Quran audio, search that finds things, Urdu / Arabic results, a "Which Ayah" button that answers
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { httpsUrl, preloadTargets, buildSurahTracks, buildRangeTracks, afterEnded } from "./audioTracks.js";
import { filterSurahs, parseAyahRef, arabicKey, latinKey } from "./surahFilter.js";
import { pickAyahLayers, resultSurahName } from "./ayahLayers.js";
import { ENTRIES } from "../i18n/translations.js";

const FRONT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../") + path.sep;
const read = (rel) => readFileSync(FRONT + rel, "utf8");

const SURAHS = [
  { number: 1, name: "سُورَةُ ٱلْفَاتِحَةِ", englishName: "Al-Faatiha", englishNameTranslation: "The Opening" },
  { number: 2, name: "سُورَةُ البَقَرَةِ", englishName: "Al-Baqara", englishNameTranslation: "The Cow" },
  { number: 36, name: "سُورَةُ يسٓ", englishName: "Ya-Sin", englishNameTranslation: "Ya Sin" },
  { number: 112, name: "سُورَةُ الإِخۡلَاصِ", englishName: "Al-Ikhlaas", englishNameTranslation: "Sincerity" },
  { number: 114, name: "سُورَةُ النَّاسِ", englishName: "An-Naas", englishNameTranslation: "Mankind" },
];
const numbers = (q) => filterSurahs(SURAHS, q).map((s) => s.number);

// ---------- audio ----------
test("http audio links are upgraded to https and the next Ayahs are chosen for downloading in advance", () => {
  assert.equal(httpsUrl("http://cdn.example/1.mp3"), "https://cdn.example/1.mp3");
  assert.equal(httpsUrl("https://cdn.example/1.mp3"), "https://cdn.example/1.mp3");
  assert.equal(httpsUrl(undefined), "");
  const tracks = [1, 2, 3, 4].map((n) => ({ audio: `https://x/${n}.mp3` }));
  assert.deepEqual(preloadTargets(tracks, 0, 2), ["https://x/2.mp3", "https://x/3.mp3"]);
  assert.deepEqual(preloadTargets(tracks, 3, 2), []);
  assert.deepEqual(preloadTargets(null, 0), []);
  assert.deepEqual(buildSurahTracks(1, [{ numberInSurah: 1, audio: "http://x/1.mp3" }])[0].audio, "https://x/1.mp3");
  const range = buildRangeTracks([{ surahNumber: 1, numberInSurah: 1 }], { 1: [{ numberInSurah: 1, audio: "http://x/1.mp3" }] });
  assert.equal(range[0].audio, "https://x/1.mp3");
  assert.equal(afterEnded("off", 0, 3), "next");
});

test("the player keeps playing when the reciter changes and starts the next Ayah at once", () => {
  const src = read("src/components/AudioPlayer.jsx");
  assert.match(src, /audioListCache/);                 // lists are remembered
  assert.match(src, /preloadTargets/);                 // next Ayahs download while one plays
  assert.match(src, /function goTo\(/);                // the source is switched in the same moment, not after a re-render
  assert.match(src, /handledRequest/);                 // an old "play this Ayah" request is not repeated after a reciter change
  assert.match(src, /AbortError/);                     // a replaced play() is not shown as an error
  assert.match(src, /setSwitching\(true\)/);
  assert.doesNotMatch(src, /return \(\) => \{ cancelled = true; audioRef\.current\?\.pause\(\); \}/); // the old cleanup that stopped the sound
  // a failed new reciter goes back to the previous one
  assert.match(src, /prevReciter/);
});

// ---------- Surah search ----------
test("Surah search finds Surahs by English, Arabic and Urdu names, numbers and meaning", () => {
  assert.deepEqual(numbers("baqarah"), [2]);
  assert.deepEqual(numbers("al baqara"), [2]);
  assert.deepEqual(numbers("yaseen"), [36]);
  assert.deepEqual(numbers("surah yasin"), [36]);
  assert.deepEqual(numbers("ikhlas"), [112]);
  assert.deepEqual(numbers("nas"), [114]);
  assert.deepEqual(numbers("cow"), [2]);
  assert.deepEqual(numbers("٢"), [2]);
  assert.deepEqual(numbers("البقرة"), [2]);
  assert.deepEqual(numbers("بقرہ"), [2]);
  assert.deepEqual(numbers("فاتحہ"), [1]);
  assert.deepEqual(numbers("سورة الناس"), [114]);
  assert.deepEqual(numbers("zzzz"), []);
  assert.equal(filterSurahs(SURAHS, "").length, SURAHS.length);
  assert.equal(filterSurahs(null, "x").length, 0);
  assert.equal(arabicKey("سُورَةُ البَقَرَةِ"), "البقره");
  assert.equal(latinKey("Al-Naas"), "alnas");
});

test("an Ayah reference typed in the Surah search opens that Ayah", () => {
  assert.deepEqual(parseAyahRef("2:255"), { surah: 2, ayah: 255 });
  assert.deepEqual(parseAyahRef("٢:٢٥٥"), { surah: 2, ayah: 255 });
  assert.equal(parseAyahRef("115:1"), null);
  assert.equal(parseAyahRef("baqara"), null);
  const list = read("src/pages/quran/SurahList.jsx");
  assert.match(list, /filterSurahs/);
  assert.match(list, /parseAyahRef/);
  assert.match(list, /quran\.searchVerses/);
});

// ---------- results in the reader's language ----------
test("search / topic / Source Finder results follow the language of the reader", () => {
  const r = { text: "Allah is with the patient.", arabicText: "إِنَّ ٱللَّهَ مَعَ ٱلصَّٰبِرِينَ", urduText: "بے شک اللہ صبر کرنے والوں کے ساتھ ہے", surahName: "Al-Baqara", surahArabicName: "سُورَةُ البَقَرَةِ" };
  assert.deepEqual(pickAyahLayers(r, "en").map((l) => l.kind), ["english"]);
  assert.deepEqual(pickAyahLayers(r, "ur").map((l) => l.kind), ["arabic", "urdu"]);
  assert.deepEqual(pickAyahLayers(r, "ar").map((l) => l.kind), ["arabic"]);
  // the Arabic / Urdu text is not available (source slow): the English text is shown instead of an empty card
  assert.deepEqual(pickAyahLayers({ text: "Patience" }, "ur").map((l) => l.kind), ["english"]);
  // the reader typed Arabic: the matched Arabic text is shown, with the searched words marked
  const hit = pickAyahLayers({ text: "الصابرين", matches: [{ kind: "arabic" }] }, "en");
  assert.equal(hit[0].kind, "arabic"); assert.equal(hit[0].marked, true);
  assert.equal(resultSurahName(r, "ur"), "سُورَةُ البَقَرَةِ");
  assert.equal(resultSurahName(r, "en"), "Al-Baqara");
  assert.deepEqual(pickAyahLayers(null, "en"), []);
});

test("Topics, Source Finder and Search ask for, and show, the Ayah in the reader's language", () => {
  for (const f of ["src/pages/topics/Topics.jsx", "src/pages/assistant/Assistant.jsx", "src/pages/search/Search.jsx"]) {
    const src = read(f);
    assert.match(src, /AyahSnippet/, f);
    assert.match(src, /resultSurahName/, f);
  }
  assert.match(read("src/pages/topics/Topics.jsx"), /fetchTopic\(slug, lang\)/);
  assert.match(read("src/pages/assistant/Assistant.jsx"), /askAssistant\(q, lang\)/);
  assert.match(read("src/pages/search/Search.jsx"), /signal: ctrl\.signal, lang/);
  assert.match(read("src/services/quranService.js"), /fetchTopic\(slug, lang\)/);
});

// ---------- Hadith search ----------
test("the Hadith results page has its own search box", () => {
  const src = read("src/pages/hadith/HadithSearch.jsx");
  assert.match(src, /role="search"/);
  assert.match(src, /hadith\.searchEverywhere/);
});

// ---------- Recite: "Which Ayah am I reciting?" ----------
test("'Which Ayah am I reciting?' is never a dead button and can search the whole Quran", () => {
  const src = read("src/pages/recitation/LiveRecitation.jsx");
  const btn = src.slice(src.indexOf("<button onClick={detectNow}"), src.indexOf("{listening && <span"));
  assert.doesNotMatch(btn, /disabled=/);
  assert.match(src, /tooFew: true/);
  assert.match(src, /searchWholeQuran/);
  assert.match(src, /types: "quran"/);
});

test("every new text exists in English, Urdu and Arabic", () => {
  for (const k of ["audio.switching", "audio.buffering", "audio.skipped", "audio.reciterFail", "topics.metaNoWords", "topics.metaOfNoWords", "quran.noSurah", "quran.searchVerses",
    "hadith.searchTip", "hadith.searchEverywhere", "live.minWordsHow", "live.wideSearching", "live.wideError", "live.wideNone", "live.wideFound", "hadith.col.bukhari"]) {
    assert.ok(Array.isArray(ENTRIES[k]) && ENTRIES[k].length === 3 && ENTRIES[k].every((v) => v && v.length > 1), k);
  }
  assert.match(ENTRIES["live.wideNone"][1], /[\u0600-\u06FF]/);
  assert.match(ENTRIES["live.wideNone"][2], /[\u0600-\u06FF]/);
});
