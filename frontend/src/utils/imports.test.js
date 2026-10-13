// Phase 22 - "smoke test" without a browser: every relative import must point to a real file,
// and every named import must be exported by that file. Catches typos before `npm run build`.
import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXT = ["", ".js", ".jsx", ".mjs", ".json", "/index.js", "/index.jsx"];

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, out);
    else if (/\.(jsx?|mjs)$/.test(name)) out.push(full);
  }
  return out;
}
function resolveFile(from, spec) {
  const base = path.resolve(path.dirname(from), spec);
  for (const e of EXT) {
    const p = base + e;
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  }
  return null;
}
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

function exportsOf(file) {
  const text = stripComments(fs.readFileSync(file, "utf8"));
  const names = new Set();
  if (/export\s+default/.test(text)) names.add("default");
  for (const m of text.matchAll(/export\s+(?:async\s+)?(?:function\*?|const|let|var|class)\s+([A-Za-z0-9_$]+)/g)) names.add(m[1]);
  for (const m of text.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(",")) {
      const p = part.trim();
      if (!p) continue;
      names.add(p.split(/\s+as\s+/).pop().trim());
    }
  }
  if (/export\s*\*\s*from/.test(text)) names.add("*");
  return names;
}

const files = walk(SRC);

test("source files were found", () => assert.ok(files.length > 100));

test("every relative import points to a file that exists", () => {
  const broken = [];
  for (const file of files) {
    const text = stripComments(fs.readFileSync(file, "utf8"));
    const specs = [
      ...[...text.matchAll(/\bfrom\s+["'](\.{1,2}\/[^"']+)["']/g)].map((m) => m[1]),
      ...[...text.matchAll(/\bimport\s*\(\s*["'](\.{1,2}\/[^"']+)["']\s*\)/g)].map((m) => m[1]),
      ...[...text.matchAll(/^\s*import\s+["'](\.{1,2}\/[^"']+)["']/gm)].map((m) => m[1]),
    ];
    for (const spec of specs) {
      if (/\.(css|svg|png|jpe?g|webp|woff2?|json)$/.test(spec)) {
        if (!fs.existsSync(path.resolve(path.dirname(file), spec))) broken.push(`${path.relative(SRC, file)} -> ${spec}`);
      } else if (!resolveFile(file, spec)) {
        broken.push(`${path.relative(SRC, file)} -> ${spec}`);
      }
    }
  }
  assert.deepStrictEqual(broken, []);
});

test("every named import exists in the file it comes from", () => {
  const problems = [];
  for (const file of files) {
    const text = stripComments(fs.readFileSync(file, "utf8"));
    for (const m of text.matchAll(/import\s+([^;'"]*?)\s+from\s+["'](\.{1,2}\/[^"']+)["']/g)) {
      const target = resolveFile(file, m[2]);
      if (!target || !/\.(jsx?|mjs)$/.test(target)) continue;
      const have = exportsOf(target);
      if (have.has("*")) continue;
      const clause = m[1];
      const def = clause.match(/^([A-Za-z0-9_$]+)\s*(,|$)/);
      if (def && !have.has("default")) problems.push(`${path.relative(SRC, file)}: default import from ${m[2]}`);
      const named = clause.match(/\{([^}]*)\}/);
      if (named) {
        for (const part of named[1].split(",")) {
          const name = part.trim().split(/\s+as\s+/)[0].trim();
          if (name && !have.has(name)) problems.push(`${path.relative(SRC, file)}: { ${name} } from ${m[2]}`);
        }
      }
    }
  }
  assert.deepStrictEqual(problems, []);
});

test("every package imported in the code is listed in package.json", () => {
  const pkg = JSON.parse(fs.readFileSync(path.resolve(SRC, "..", "package.json"), "utf8"));
  const known = new Set([...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.devDependencies || {})]);
  const builtin = new Set(["node:test", "node:assert", "node:fs", "node:path", "node:url"]);
  const missing = new Set();
  for (const file of files) {
    if (/\.test\.js$/.test(file)) continue;
    const text = stripComments(fs.readFileSync(file, "utf8"));
    for (const m of text.matchAll(/\bfrom\s+["']([^."'][^"']*)["']/g)) {
      const parts = m[1].split("/");
      const name = m[1].startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
      if (!known.has(name) && !builtin.has(m[1])) missing.add(`${name} (${path.relative(SRC, file)})`);
    }
  }
  assert.deepStrictEqual([...missing], []);
});

test("every page in App.jsx lazy() loads a file that exists", () => {
  const app = fs.readFileSync(path.join(SRC, "App.jsx"), "utf8");
  const specs = [...app.matchAll(/lazy\(\s*\(\)\s*=>\s*import\(\s*["']([^"']+)["']/g)].map((m) => m[1]);
  assert.ok(specs.length >= 25);
  for (const s of specs) assert.ok(resolveFile(path.join(SRC, "App.jsx"), s), `missing page ${s}`);
});
