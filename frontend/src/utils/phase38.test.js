// Phase 38 - one navbar, no footer display switch, Dua of the Day, device prayer times, staying logged in
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { DAILY_DUAS, duaForDate, dayNumber, duaShareText } from "./dailyDua.js";
import { calculateTimes, offlinePrayerData } from "./solarTimes.js";
import { ENTRIES } from "../i18n/translations.js";

const FRONT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../") + path.sep;
const read = (rel) => readFileSync(FRONT + rel, "utf8");

test("every daily dua has Arabic, Urdu, English and a source, and ids are unique", () => {
  assert.ok(DAILY_DUAS.length >= 30);
  assert.equal(new Set(DAILY_DUAS.map((d) => d.id)).size, DAILY_DUAS.length);
  for (const d of DAILY_DUAS) {
    assert.match(d.ar, /[\u0600-\u06FF]/, d.id);
    assert.match(d.ur, /[\u0600-\u06FF]/, d.id);
    assert.ok(d.en.length > 10, d.id);
    assert.ok(d.ref.length > 5, d.id);
  }
});

test("the dua is the same all day, changes at midnight, and 'another dua' moves on", () => {
  const morning = new Date(2026, 9, 12, 6, 0, 0);
  const night = new Date(2026, 9, 12, 23, 59, 0);
  const next = new Date(2026, 9, 13, 0, 1, 0);
  assert.equal(duaForDate(morning).id, duaForDate(night).id);
  assert.notEqual(duaForDate(night).id, duaForDate(next).id);
  assert.notEqual(duaForDate(morning, 1).id, duaForDate(morning).id);
  assert.ok(duaForDate(morning, -1000));            // never undefined
  assert.equal(dayNumber(next) - dayNumber(night), 1);
  assert.match(duaShareText(DAILY_DUAS[0], "en"), /SIRAJ/);
});

test("device prayer times are in the right order and sensible for Lahore", () => {
  const t = calculateTimes({ year: 2026, month: 10, day: 11 }, { latitude: 31.5204, longitude: 74.3587 }, { method: 1, school: 1, tzOffsetHours: 5 });
  const mins = (x) => Number(x.slice(0, 2)) * 60 + Number(x.slice(3));
  const order = ["Imsak", "Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"].map((k) => mins(t[k]));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  assert.ok(mins(t.Dhuhr) >= 11 * 60 + 40 && mins(t.Dhuhr) <= 12 * 60 + 5);
  assert.ok(mins(t.Sunrise) >= 5 * 60 + 50 && mins(t.Sunrise) <= 6 * 60 + 30);
  // Hanafi Asr is later than the other schools
  const shafi = calculateTimes({ year: 2026, month: 10, day: 11 }, { latitude: 31.5204, longitude: 74.3587 }, { method: 1, school: 0, tzOffsetHours: 5 });
  assert.ok(mins(t.Asr) > mins(shafi.Asr));
});

test("device prayer data has the same shape as the server answer", () => {
  const d = offlinePrayerData({ latitude: 31.5204, longitude: 74.3587 }, new Date(2026, 9, 11, 15), { method: 1, school: 1 });
  assert.match(d.gregorianDate, /^\d{2}-\d{2}-\d{4}$/);
  assert.equal(d.source, "device");
  for (const k of ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"]) assert.match(d.timings[k], /^\d{2}:\d{2}$/);
});

test("navbar: no More menu, every link sits in one sliding line", () => {
  const nav = read("src/components/Navbar.jsx");
  assert.doesNotMatch(nav, /EXPLORE_LINKS|nav\.explore/);
  assert.match(nav, /<NavStrip \/>/);
  assert.doesNotMatch(nav, /MoreMenu/);
  assert.match(nav, /ALL_LINKS\.map/);
  for (const to of ["/ramadan", "/calendar", "/topics", "/assistant", "/feedback", "/tafseer", "/tasbeeh", "/duas"]) assert.ok(nav.includes(`to: "${to}"`), to);
  assert.ok(ENTRIES["nav.more"]);
});

test("the footer has no display-mode switch any more", () => {
  assert.doesNotMatch(read("src/components/Footer.jsx"), /LiteModeSwitch/);
  assert.ok(!existsSync(FRONT + "src/components/LiteModeSwitch.jsx"));
});

test("the Prayer page and the Home page show the Dua of the Day", () => {
  assert.match(read("src/pages/user/Prayer.jsx"), /<DailyDua/);
  assert.match(read("src/pages/public/Home.jsx"), /<DailyDua/);
});

test("staying logged in: the page asks the server for a session on every start and refresh requests share one call", () => {
  const ctx = read("src/context/AuthContext.jsx");
  assert.match(ctx, /refreshRequest\(\)/);
  assert.match(ctx, /status === 401 \|\| status === 403/); // a bad connection does not log anyone out
  const api = read("src/services/api.js");
  assert.match(api, /let refreshing = null/);
  assert.match(api, /NO_REFRESH/);
});

test("the service worker lets the open page show the reminder and bumps its version", () => {
  const sw = read("public/sw.js");
  assert.match(sw, /siraj-v40/);
  assert.match(sw, /visibilityState === "visible"/);
});
