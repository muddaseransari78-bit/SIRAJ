import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { contrastRatio, AA_NORMAL } from "./contrast.js";
import { THEMES } from "../theme/themes.js";

const css = readFileSync(fileURLToPath(new URL("../index.css", import.meta.url)), "utf8");
const night = THEMES.find((t) => t.id === "night").c; // the original dark palette
const noor = { ...night };
const SOFT_BG = "#f6f0e1"; // .reader-soft background in index.css
const SOFT_BG2 = "#e9e0c8"; // .reader-soft .bg-noor-surface2

test("contrastRatio matches known values", () => {
  assert.equal(contrastRatio("#000000", "#ffffff").toFixed(1), "21.0");
  assert.equal(contrastRatio("#777777", "#777777").toFixed(1), "1.0");
});

test("main site text colours pass WCAG AA on every dark surface", () => {
  for (const surface of [noor.bg, noor.surface, noor.surface2]) {
    for (const name of ["text", "textMuted", "gold", "goldBright"]) {
      const ratio = contrastRatio(noor[name], surface);
      assert.ok(ratio >= AA_NORMAL, `${name} on ${surface} is only ${ratio.toFixed(2)}`);
    }
  }
});

test("gold buttons (dark text on gold) pass AA", () => {
  assert.ok(contrastRatio(noor.bg, noor.gold) >= AA_NORMAL);
  assert.ok(contrastRatio(noor.bg, noor.goldBright) >= AA_NORMAL);
});

test("error text (red-400) is readable on the card colour", () => {
  assert.ok(contrastRatio("#f87171", noor.surface2) >= AA_NORMAL);
});

// ---- Phase 29: every theme must stay readable (WCAG AA), so a new colour can never make text disappear
test("every theme: text, muted text, accent and status colours pass AA on bg / surface / surface2", () => {
  assert.ok(THEMES.length >= 9);
  for (const t of THEMES) {
    for (const surface of ["bg", "surface", "surface2"]) {
      for (const name of ["text", "textMuted", "gold", "goldBright", "danger", "success", "warn"]) {
        const ratio = contrastRatio(t.c[name], t.c[surface]);
        assert.ok(ratio >= AA_NORMAL, `${t.id}: ${name} on ${surface} is only ${ratio.toFixed(2)}`);
      }
    }
  }
});

test("every theme: text on accent buttons (onAccent on gold / goldBright) passes AA", () => {
  for (const t of THEMES) {
    for (const name of ["gold", "goldBright"]) {
      const ratio = contrastRatio(t.c.onAccent, t.c[name]);
      assert.ok(ratio >= AA_NORMAL, `${t.id}: onAccent on ${name} is only ${ratio.toFixed(2)}`);
    }
  }
});

test("every theme has a unique id, a mode and all colour roles as #RRGGBB", () => {
  const ids = new Set(THEMES.map((t) => t.id));
  assert.equal(ids.size, THEMES.length);
  for (const t of THEMES) {
    assert.ok(t.mode === "dark" || t.mode === "light", t.id);
    for (const [k, v] of Object.entries(t.c)) assert.match(v, /^#[0-9a-fA-F]{6}$/, `${t.id}.${k}`);
  }
});

test("soft reading mode text passes AA", () => {
  assert.ok(contrastRatio("#2b2a26", SOFT_BG) >= AA_NORMAL);
  assert.ok(contrastRatio("#5f5b50", SOFT_BG) >= AA_NORMAL);
  assert.ok(contrastRatio("#5f5b50", SOFT_BG2) >= AA_NORMAL);
  assert.ok(contrastRatio("#8a6516", SOFT_BG) >= AA_NORMAL);
});

// Reads the real Tajweed colours out of index.css so this test can never drift from the stylesheet.
function tajweedColours() {
  const found = [];
  const rule = /([^{}]+)\{\s*color:\s*(#[0-9a-fA-F]{6});?\s*\}/g;
  let m;
  while ((m = rule.exec(css))) {
    const selector = m[1].trim();
    if (!selector.includes(".tj-")) continue;
    found.push({ selector, colour: m[2], soft: selector.includes(".reader-soft") || selector.includes('data-mode="light"') });
  }
  return found;
}

test("every Tajweed colour passes AA on its own background (dark and soft mode)", () => {
  const colours = tajweedColours();
  assert.ok(colours.length >= 20, `expected many Tajweed colours, found ${colours.length}`);
  assert.ok(colours.some((c) => c.soft) && colours.some((c) => !c.soft));
  for (const { selector, colour, soft } of colours) {
    const ratio = contrastRatio(colour, soft ? SOFT_BG : noor.bg);
    assert.ok(ratio >= AA_NORMAL, `${selector} ${colour} is only ${ratio.toFixed(2)}`);
  }
  // Phase 29: the same colours must also work on every theme. Quran text is read on the page background (full AA)
  // and sometimes inside a card (a little looser, same as the original palette which had 4.4 on surface2).
  for (const t of THEMES) {
    for (const { selector, colour, soft } of colours) {
      if (soft !== (t.mode === "light")) continue; // light shades are used on light themes, dark shades on dark themes
      const onBg = contrastRatio(colour, t.c.bg);
      assert.ok(onBg >= AA_NORMAL, `${t.id}: ${selector} ${colour} on bg is only ${onBg.toFixed(2)}`);
      const onCard = contrastRatio(colour, t.c.surface);
      assert.ok(onCard >= 4.0, `${t.id}: ${selector} ${colour} on card is only ${onCard.toFixed(2)}`);
    }
  }
});
