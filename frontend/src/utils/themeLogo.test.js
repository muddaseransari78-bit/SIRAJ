// Deployment clean-up - the SIRAJ logo changes colour with the theme.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { THEMES } from "../theme/themes.js";
import { THEME_LOGO, logoFile, LOGO_FULL, LOGO_SMALL } from "../theme/themeMedia.js";

const FRONT = fileURLToPath(new URL("../../", import.meta.url));
const read = (rel) => readFileSync(FRONT + rel, "utf8");

test("every theme has a logo, in a big and a small size, and the files exist and are web-sized", () => {
  for (const th of THEMES) {
    assert.ok(THEME_LOGO[th.id], `no logo colour for theme ${th.id}`);
    for (const small of [false, true]) {
      const file = FRONT + "public" + logoFile(th.id, small);
      assert.ok(existsSync(file), `missing ${file}`);
      assert.ok(statSync(file).size < 200 * 1024, `${file} is too big for a logo`);
    }
  }
});

test("dark green themes keep the original logo, the other themes get their own colour", () => {
  assert.equal(logoFile("night"), LOGO_FULL);
  assert.equal(logoFile("emerald", true), LOGO_SMALL);
  assert.notEqual(logoFile("glass"), LOGO_FULL);
  assert.notEqual(logoFile("gold"), logoFile("glass"));
  assert.match(logoFile("lightblue", true), /-sm\.webp$/);
});

test("an unknown theme falls back to the original logo", () => {
  assert.equal(logoFile("nope"), LOGO_FULL);
  assert.equal(logoFile(undefined, true), LOGO_SMALL);
});

test("navbar, footer, login/register and the loading screen use the theme logo (not a fixed file)", () => {
  for (const f of ["components/Navbar.jsx", "components/Footer.jsx", "components/auth/AuthShell.jsx", "components/SplashScreen.jsx", "pages/public/Home.jsx"]) {
    const src = read("src/" + f);
    assert.match(src, /logoFile\(/, `${f} must use logoFile()`);
    assert.doesNotMatch(src, /src=\{LOGO_(SMALL|FULL)\}/, `${f} still shows a fixed logo`);
  }
});

test("the boot logo in index.html follows the saved theme for every coloured logo", () => {
  const html = read("index.html");
  for (const name of new Set(Object.values(THEME_LOGO).filter((n) => n !== "default"))) {
    assert.match(html, new RegExp(`/media/logo/${name}-sm\\.webp`), `index.html boot logo misses ${name}`);
  }
});

test("a build without VITE_API_BASE_URL is announced, and production never falls back to localhost", () => {
  const api = read("src/services/api.js");
  assert.match(api, /import\.meta\.env\.DEV \? "http:\/\/localhost:5000\/api" : ""/);
  assert.match(api, /VITE_API_BASE_URL was not set/);
  assert.match(read("vite.config.js"), /VITE_API_BASE_URL is not set/);
});
