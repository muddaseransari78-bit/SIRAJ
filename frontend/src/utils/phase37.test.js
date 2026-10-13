// Phase 37 - glass hover cards, scroll sections, login / register, big footer name
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { ENTRIES } from "../i18n/translations.js";
import { passwordStrength } from "./passwordStrength.js";

const FRONT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../") + path.sep;
const read = (rel) => readFileSync(FRONT + rel, "utf8");

test("password meter goes from weak to strong", () => {
  assert.equal(passwordStrength(""), 0);
  assert.equal(passwordStrength("abc"), 1);
  assert.equal(passwordStrength("abcdefgh"), 1); // no number
  assert.equal(passwordStrength("abcdefg1"), 2);
  assert.equal(passwordStrength("Abcdefgh12"), 3);
  assert.equal(passwordStrength("Abcdefgh12!?"), 4);
});

test("new text keys exist in English, Urdu and Arabic", () => {
  const keys = Object.keys(ENTRIES).filter((k) => /^(home\.(stats|why|spot|how)\.|auth\.(perk|social|strength|apple|or|agree|loginSub|registerSub|showPassword|hidePassword)|footer\.madeFor)/.test(k));
  assert.ok(keys.length >= 30, `only ${keys.length} keys found`);
  for (const k of keys) {
    assert.ok(Array.isArray(ENTRIES[k]) && ENTRIES[k].length === 3 && ENTRIES[k].every((x) => x.trim()), k);
  }
  // placeholders must be the same in all three languages
  for (const k of keys) {
    const ph = ENTRIES[k].map((x) => (x.match(/\{\w+\}/g) || []).sort().join(","));
    assert.equal(new Set(ph).size, 1, `placeholders differ in ${k}`);
  }
});

test("login and register have no Google / Apple / phone-code sign-in (removed)", () => {
  for (const page of ["Login", "Register"]) {
    const code = read(`src/pages/public/${page}.jsx`);
    assert.doesNotMatch(code, /SocialButtons|socialAuth|useSocialProviders/);
    assert.match(code, /<PressButton/);
    assert.doesNotMatch(code, /PhoneOtp|auth\.phone/);
  }
  assert.ok(!existsSync(FRONT + "src/components/auth/SocialButtons.jsx"));
  assert.ok(!existsSync(FRONT + "src/components/auth/PhoneOtp.jsx"));
});

test("the main button sinks when pressed", () => {
  const css = read("src/index.css");
  assert.match(css, /\.btn-3d:active:not\(:disabled\)/);
  assert.match(css, /inset 0 5px 14px/);
});

test("hover glass cards are used on the home page and are off in Lite mode", () => {
  const css = read("src/index.css");
  assert.match(css, /\.fx-card::after/);
  assert.match(css, /html\[data-lite="true"\] \.fx-card::before/);
  const home = read("src/pages/public/Home.jsx");
  assert.ok((home.match(/fx-card/g) || []).length >= 2);
  assert.match(home, /<FeatureSpotlights/);
  assert.match(home, /<StatsBand/);
  assert.match(home, /<HowItWorks/);
});

test("the footer ends with the big SIRAJ name", () => {
  const footer = read("src/components/Footer.jsx");
  assert.match(footer, /<FooterWordmark \/>/);
  assert.match(footer, /"SIRAJ"\.split\(""\)/);
  assert.match(read("src/index.css"), /\.footer-mark-word/);
});

test("the login form keeps working with the old field ids and the account helper exists", () => {
  const login = read("src/pages/public/Login.jsx");
  assert.match(login, /id="email"/);
  assert.match(login, /id="password"/);
  assert.match(login, /id="login-error"/);
  assert.match(read("src/context/AuthContext.jsx"), /applySession/);
});
