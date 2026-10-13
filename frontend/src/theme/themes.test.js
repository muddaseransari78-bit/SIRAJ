import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { THEMES, THEME_MAP, DEFAULT_THEME, getTheme, hexToTriplet, threePalette } from "./themes.js";
import { buildCss, buildInit } from "../../scripts/gen-theme-css.mjs";

const read = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

test("hexToTriplet gives the space-separated rgb Tailwind needs", () => {
  assert.equal(hexToTriplet("#C9A24B"), "201 162 75");
  assert.equal(hexToTriplet("#000000"), "0 0 0");
});

test("the requested themes all exist (light, greenish, light blue, deep night, emerald, gold, light gold, soft cream, glass)", () => {
  for (const id of ["light", "green", "lightblue", "night", "emerald", "gold", "lightgold", "cream", "glass"]) assert.ok(THEME_MAP[id], id);
});

test("unknown theme ids fall back to the default", () => {
  assert.equal(getTheme("nope").id, DEFAULT_THEME);
  assert.equal(getTheme(undefined).id, DEFAULT_THEME);
});

test("src/theme/themes.css and public/theme-init.js are up to date (run: npm run theme:css)", () => {
  assert.equal(read("./themes.css"), buildCss());
  assert.equal(read("../../public/theme-init.js"), buildInit());
});

test("every theme id has a name in the dictionary (theme.<id>)", async () => {
  const { translations } = await import("../i18n/translations.js");
  for (const t of THEMES) {
    for (const lang of ["en", "ur", "ar"]) assert.ok(translations[lang][`theme.${t.id}`], `${lang} theme.${t.id}`);
  }
});

test("3D palette follows the theme mode", () => {
  assert.equal(threePalette(THEME_MAP.night).light, false);
  assert.equal(threePalette(THEME_MAP.cream).light, true);
  assert.equal(threePalette(THEME_MAP.emerald).accent, THEME_MAP.emerald.c.gold);
});
