import test from "node:test";
import assert from "node:assert";
import { SURAH_SLUGS, surahSlug, surahPath, resolveSurahParam, slugToTitle } from "./surahSlugs.js";
import { resolveMeta, isPrivatePath, DEFAULT_TITLE } from "./seo.js";

test("there are exactly 114 unique Surah slugs", () => {
  assert.equal(SURAH_SLUGS.length, 114);
  assert.equal(new Set(SURAH_SLUGS).size, 114);
  assert.ok(SURAH_SLUGS.every((s) => /^[a-z]+(-[a-z]+)*$/.test(s)), "slugs are lowercase words joined by '-'");
});

test("well-known Surahs sit at the right number", () => {
  assert.equal(SURAH_SLUGS[0], "al-fatiha");
  assert.equal(SURAH_SLUGS[1], "al-baqarah");
  assert.equal(SURAH_SLUGS[17], "al-kahf");
  assert.equal(SURAH_SLUGS[35], "ya-sin");
  assert.equal(SURAH_SLUGS[111], "al-ikhlas");
  assert.equal(SURAH_SLUGS[113], "an-nas");
});

test("slug and number resolve both ways", () => {
  assert.equal(resolveSurahParam("al-baqarah"), 2);
  assert.equal(resolveSurahParam("AL-BAQARAH"), 2);
  assert.equal(resolveSurahParam("2"), 2);
  assert.equal(resolveSurahParam("114"), 114);
  assert.equal(resolveSurahParam("0"), null);
  assert.equal(resolveSurahParam("115"), null);
  assert.equal(resolveSurahParam("nonsense"), null);
  assert.equal(resolveSurahParam(undefined), null);
  for (let n = 1; n <= 114; n++) assert.equal(resolveSurahParam(surahSlug(n)), n);
});

test("surahPath builds links", () => {
  assert.equal(surahPath(2, "?ayah=42"), "/quran/al-baqarah?ayah=42");
  assert.equal(surahPath(999), "/quran/999");
  assert.equal(slugToTitle("ash-shuara"), "Ash Shuara");
});

test("meta: Surah page names the Surah and uses the slug as canonical path", () => {
  const m = resolveMeta("/quran/1");
  assert.match(m.title, /Al Fatiha/);
  assert.equal(m.path, "/quran/al-fatiha");
  assert.equal(m.noindex, false);
  assert.equal(resolveMeta("/quran/al-kahf").path, "/quran/al-kahf");
});

test("meta: normal pages, unknown pages, trailing slash", () => {
  assert.match(resolveMeta("/prayer").title, /Prayer Times/);
  assert.equal(resolveMeta("/prayer/").path, "/prayer");
  assert.equal(resolveMeta("/something-else").title, DEFAULT_TITLE);
  assert.match(resolveMeta("/quran/juz/3").title, /Quran/);
});

test("meta: private pages are noindex, public ones are not", () => {
  for (const p of ["/dashboard", "/bookmarks", "/profile", "/admin", "/login", "/register"]) assert.equal(isPrivatePath(p), true, p);
  for (const p of ["/", "/quran", "/hadith", "/qibla", "/about"]) assert.equal(isPrivatePath(p), false, p);
  assert.equal(resolveMeta("/profile").noindex, true);
});
