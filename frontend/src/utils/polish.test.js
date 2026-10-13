import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = fileURLToPath(new URL("..", import.meta.url));
const css = readFileSync(join(SRC, "index.css"), "utf8");
const headers = readFileSync(join(SRC, "..", "public", "_headers"), "utf8");

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

// I cannot run `vite build` in every environment, so this catches the most common build breaker:
// an import that points at a file that does not exist (typo, wrong ../ depth, forgotten file).
test("every relative import in src points at a real file", () => {
  const files = walk(SRC).filter((f) => /\.(jsx?|mjs)$/.test(f) && !f.endsWith(".test.js"));
  const missing = [];
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    const re = /(?:import|export)[^'"`]*?from\s*["'](\.[^"']+)["']|import\(\s*["'](\.[^"']+)["']\s*\)|^import\s+["'](\.[^"']+)["']/gm;
    let m;
    while ((m = re.exec(text))) {
      const spec = m[1] || m[2] || m[3];
      const base = resolve(dirname(file), spec);
      const candidates = [base, `${base}.js`, `${base}.jsx`, join(base, "index.js"), join(base, "index.jsx")];
      if (!candidates.some((c) => existsSync(c) && statSync(c).isFile())) missing.push(`${file.replace(SRC, "src/")} -> ${spec}`);
    }
  }
  assert.deepEqual(missing, []);
});

test("star pattern is a safe inline SVG (no raw # < > that would break the CSS url)", () => {
  const uris = [...css.matchAll(/url\("(data:image\/svg\+xml,[^"]+)"\)/g)].map((m) => m[1]);
  assert.ok(uris.length >= 2, "geo-pattern and footer-pattern should both use the inline SVG");
  for (const uri of uris) {
    const body = uri.slice(uri.indexOf(",") + 1);
    assert.doesNotMatch(body, /[<>#]/);
    const decoded = decodeURIComponent(body);
    assert.match(decoded, /<polygon/);
    assert.match(decoded, /xmlns=/);
  }
});

test("inline SVG backgrounds are allowed by the CSP (img-src needs data:)", () => {
  const csp = headers.split("\n").find((l) => l.includes("Content-Security-Policy"));
  assert.match(csp, /img-src[^;]*data:/);
});

test("Ayah highlight works in soft mode and right-to-left, and respects Lite mode", () => {
  assert.match(css, /\.reader-soft \.ayah-active/);
  assert.match(css, /\[dir="rtl"\] \.ayah-active/);
  assert.match(css, /html\[data-lite="true"\] \.ayah-active \{ animation: none; \}/);
});

test("decorative pattern layers never catch clicks", () => {
  assert.match(css, /\.geo-pattern \{[^}]*pointer-events: none/);
  assert.match(css, /\.footer-pattern::before \{[^}]*pointer-events: none/);
});
