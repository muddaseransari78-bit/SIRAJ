// Phase 36 - theme pictures, glass, hero video, loading screen, scroll animation.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { THEMES } from "../theme/themes.js";
import { THEME_BG, bgFile, bgName, HERO_POSTER, HERO_POSTER_SMALL, LOGO_FULL, LOGO_SMALL, pickHeroVideo, HERO_VIDEOS } from "../theme/themeMedia.js";
import { splashPlan, easedProgress } from "./splash.js";
import { revealDelay } from "./reveal.js";
import { ENTRIES } from "../i18n/translations.js";

const FRONT = fileURLToPath(new URL("../../", import.meta.url));
const read = (rel) => readFileSync(FRONT + rel, "utf8");
const pub = (url) => FRONT + "public" + url;

test("every theme has its own background picture, in a desktop and a phone size, and they are web-sized", () => {
  for (const th of THEMES) {
    assert.ok(THEME_BG[th.id], `no background for theme ${th.id}`);
    for (const small of [false, true]) {
      const file = pub(bgFile(th.id, small));
      assert.ok(existsSync(file), `missing ${file}`);
      assert.ok(statSync(file).size < 400 * 1024, `${file} is too big for a background`);
    }
  }
  assert.equal(new Set(Object.values(THEME_BG)).size, THEMES.length, "two themes share one picture");
});

test("unknown theme ids fall back to the default picture", () => {
  assert.equal(bgName("nope"), "night");
  assert.equal(bgFile("nope", true), "/media/bg/night-sm.webp");
});

test("logo and hero video files exist and the video is small enough for mobile data", () => {
  for (const url of [LOGO_FULL, LOGO_SMALL, HERO_POSTER, HERO_POSTER_SMALL, ...HERO_VIDEOS.map((v) => v.src)]) {
    assert.ok(existsSync(pub(url)), `missing ${url}`);
  }
  assert.ok(statSync(pub(HERO_VIDEOS[0].src)).size < 600 * 1024, "phone video should stay under 600 KB");
  assert.ok(statSync(pub(HERO_VIDEOS[2].src)).size < 3 * 1024 * 1024, "desktop video should stay under 3 MB");
});

test("the hero video size follows the screen width and Data Saver turns it off", () => {
  assert.match(pickHeroVideo(360), /480/);
  assert.match(pickHeroVideo(820), /720/);
  assert.match(pickHeroVideo(1920), /1080/);
  assert.equal(pickHeroVideo(1920, { saveData: true }), "");
  assert.match(pickHeroVideo(NaN), /1080/);
});

test("loading screen: calm version for Lite mode / reduced motion, hard time limit always", () => {
  const full = splashPlan({});
  const calm = splashPlan({ lite: true });
  assert.equal(full.fancy, true);
  assert.equal(calm.fancy, false);
  assert.equal(splashPlan({ reduced: true }).fancy, false);
  assert.ok(calm.minMs < full.minMs);
  assert.ok(full.maxMs <= 8000 && calm.maxMs <= 4000, "the loading screen must never block the site for long");
  assert.ok(easedProgress(0, 2000) === 0);
  assert.ok(easedProgress(99999, 2000) <= 0.9, "bar only reaches 100% when the site is really ready");
  assert.ok(easedProgress(1000, 2000) > easedProgress(500, 2000));
});

test("scroll reveal staggers the first few cards only", () => {
  assert.equal(revealDelay(0), 0);
  assert.ok(revealDelay(3) > revealDelay(1));
  assert.equal(revealDelay(50), revealDelay(6));
  assert.equal(revealDelay(-4), 0);
});

test("the hero uses the video and the old 3D SIRAJ scene is gone", () => {
  const home = read("src/pages/public/Home.jsx");
  assert.ok(home.includes("<video"), "Home hero should have the video");
  assert.doesNotMatch(home, /HeroScene|@react-three|three\//);
  assert.ok(!existsSync(FRONT + "src/three/HeroScene.jsx"));
  assert.match(home, /muted/);
  assert.match(home, /playsInline/);
});

test("navbar has the logo that the loading screen flies to", () => {
  const nav = read("src/components/Navbar.jsx");
  assert.match(nav, /id="nav-logo"/);
  const splash = read("src/components/SplashScreen.jsx");
  assert.match(splash, /getElementById\("nav-logo"\)/);
  const css = read("src/index.css");
  assert.match(css, /html\[data-splash="on"\] #nav-logo/);
});

test("the stylesheet has a loading-screen picture for every theme", () => {
  const css = read("src/index.css");
  for (const th of THEMES) assert.ok(css.includes(`html[data-theme="${th.id}"] { --splash-img: url("/media/bg/${bgName(th.id)}-sm.webp"); }`), th.id);
});

test("glass is only used while a picture is behind the page, and Lite mode switches the blur off", () => {
  const css = read("src/index.css");
  assert.match(css, /html\[data-bg="on"\] :is\(\.glass-card/);
  assert.match(css, /html\[data-lite="true"\]\[data-bg="on"\]/);
  assert.match(css, /prefers-reduced-motion: reduce\) \{ \.rv/);
});

test("the page shell never allows sideways scrolling and respects phone notches", () => {
  const css = read("src/index.css");
  const html = read("index.html");
  assert.match(css, /overflow-x: clip/);
  assert.match(html, /viewport-fit=cover/);
  assert.match(css, /safe-area-inset-bottom/);
});

test("index.html has no inline script (the security policy forbids it) and shows a boot logo", () => {
  const html = read("index.html");
  const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*type="application\/ld\+json")[^>]*>/g)];
  assert.deepEqual(inline, []);
  assert.match(html, /id="boot"/);
});

test("the service worker never stores the hero video", () => {
  const sw = read("public/sw.js");
  assert.match(sw, /\/media\/video\//);
  assert.match(sw, /siraj-v40/);
});

test("new text keys exist in English, Urdu and Arabic", () => {
  for (const key of ["splash.loading", "splash.skip", "home.scrollDown", "home.cta.title", "home.cta.body", "home.cta.start", "home.cta.join", "error.title", "error.body", "error.retry", "error.reload"]) {
    assert.ok(Array.isArray(ENTRIES[key]) && ENTRIES[key].length === 3, key);
  }
});

test("a broken part of the page cannot take the whole site down", () => {
  const layout = read("src/layouts/MainLayout.jsx");
  assert.match(layout, /<CrashScreen/);
  assert.match(layout, /<ErrorBoundary fallback=\{null\}><SiteBackground/);
  assert.match(read("src/main.jsx"), /<ErrorBoundary/);
  assert.match(read("src/App.jsx"), /<SplashScreen/);
});
