// Phase 22 - "does everything connect?" without MongoDB or a network:
// every relative require() must find its file, every destructured name must exist in that file,
// every npm package used must be listed in package.json, and .env.example must list the variables the code reads.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const SKIP_DIRS = new Set(["node_modules", "tests"]);

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) { if (!SKIP_DIRS.has(name)) walk(full, out); }
    else if (name.endsWith(".js")) out.push(full);
  }
  return out;
}
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
function resolve(from, spec) {
  const base = path.resolve(path.dirname(from), spec);
  for (const e of ["", ".js", ".json", "/index.js"]) {
    const p = base + e;
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  }
  return null;
}

const files = walk(ROOT);

test("backend source files were found", () => assert.ok(files.length > 80));

test("every relative require() finds a file", () => {
  const broken = [];
  for (const f of files) {
    const text = strip(fs.readFileSync(f, "utf8"));
    for (const m of text.matchAll(/require\(\s*["'](\.{1,2}\/[^"']+)["']\s*\)/g)) {
      if (!resolve(f, m[1])) broken.push(`${path.relative(ROOT, f)} -> ${m[1]}`);
    }
  }
  assert.deepStrictEqual(broken, []);
});

test("every name in const { a, b } = require('./x') is exported by x", () => {
  const problems = [];
  for (const f of files) {
    const text = strip(fs.readFileSync(f, "utf8"));
    for (const m of text.matchAll(/const\s*\{([^}]+)\}\s*=\s*require\(\s*["'](\.{1,2}\/[^"']+)["']\s*\)/g)) {
      const target = resolve(f, m[2]);
      if (!target || !target.endsWith(".js")) continue;
      const src = strip(fs.readFileSync(target, "utf8"));
      for (const part of m[1].split(",")) {
        const name = part.trim().split(":")[0].trim();
        if (!name) continue;
        // everything after "module.exports" (nested { } are fine) or an exports.name = ... line
        const at = src.indexOf("module.exports");
        const exported = (at >= 0 && new RegExp(`\\b${name}\\b`).test(src.slice(at))) || new RegExp(`exports\\.${name}\\s*=`).test(src);
        if (!exported) problems.push(`${path.relative(ROOT, f)}: { ${name} } from ${m[2]}`);
      }
    }
  }
  assert.deepStrictEqual(problems, []);
});

test("every npm package the code requires is listed in package.json", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  const known = new Set([...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.devDependencies || {})]);
  const builtin = new Set(require("node:module").builtinModules);
  const missing = new Set();
  for (const f of files) {
    const text = strip(fs.readFileSync(f, "utf8"));
    for (const m of text.matchAll(/require\(\s*["']([^."'][^"']*)["']\s*\)/g)) {
      const spec = m[1].replace(/^node:/, "");
      const name = m[1].startsWith("@") ? m[1].split("/").slice(0, 2).join("/") : m[1].split("/")[0].replace(/^node:/, "");
      if (!known.has(name) && !builtin.has(spec) && !builtin.has(name)) missing.add(`${name} (${path.relative(ROOT, f)})`);
    }
  }
  assert.deepStrictEqual([...missing], []);
});

test(".env.example lists every process.env variable the code reads", () => {
  const example = fs.readFileSync(path.join(ROOT, ".env.example"), "utf8");
  const listed = new Set([...example.matchAll(/^\s*#?\s*([A-Z][A-Z0-9_]+)\s*=/gm)].map((m) => m[1]));
  const optional = new Set(["NODE_ENV", "PORT", "npm_package_version", "SMOKE_URL", "API_URL", "SITE_URL"]); // these belong to scripts/smoke.js and scripts/deploy-check.js only
  const used = new Map();
  for (const f of files) {
    const text = strip(fs.readFileSync(f, "utf8"));
    for (const m of text.matchAll(/process\.env\.([A-Z][A-Z0-9_]+)/g)) used.set(m[1], path.relative(ROOT, f));
  }
  const missing = [...used].filter(([k]) => !listed.has(k) && !optional.has(k));
  assert.deepStrictEqual(missing, []);
});

test(".env.example holds no real-looking secrets", () => {
  const example = fs.readFileSync(path.join(ROOT, ".env.example"), "utf8");
  assert.ok(!/mongodb\+srv:\/\/[^<\s]+:[^<\s]+@/.test(example), "a real Atlas password may be in .env.example");
  for (const m of example.matchAll(/^(JWT_[A-Z_]*SECRET)\s*=\s*(.*)$/gm)) {
    assert.ok(/change|your|example|replace|xxx|secret/i.test(m[2]) || m[2].trim() === "", `${m[1]} must be a placeholder`);
  }
});

test(".gitignore keeps .env and node_modules out of Git", () => {
  const gi = fs.readFileSync(path.join(ROOT, "..", ".gitignore"), "utf8");
  assert.match(gi, /^\.env$/m);
  assert.match(gi, /node_modules/);
});
