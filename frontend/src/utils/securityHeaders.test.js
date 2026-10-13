import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = (p) => fileURLToPath(new URL(`../../${p}`, import.meta.url));
const vercel = JSON.parse(readFileSync(root("vercel.json"), "utf8"));
const netlify = readFileSync(root("public/_headers"), "utf8");

const vercelHeaders = Object.fromEntries(vercel.headers.find((h) => h.source === "/(.*)").headers.map((h) => [h.key, h.value]));
const netlifyHeaders = {};
for (const line of netlify.split("\n")) {
  const m = line.match(/^ {2}([A-Za-z-]+): (.+)$/);
  if (m && !(m[1] in netlifyHeaders) && !/Cache-Control/.test(m[1])) netlifyHeaders[m[1]] = m[2];
}

test("vercel.json and public/_headers carry the same security headers", () => {
  assert.deepEqual(netlifyHeaders, vercelHeaders);
});

test("all important security headers are present", () => {
  for (const name of ["Content-Security-Policy", "X-Content-Type-Options", "X-Frame-Options", "Referrer-Policy", "Permissions-Policy", "Strict-Transport-Security"]) {
    assert.ok(vercelHeaders[name], `${name} missing`);
  }
});

test("CSP keeps scripts strict and blocks plugins and framing", () => {
  const csp = vercelHeaders["Content-Security-Policy"];
  const script = csp.split(";").map((d) => d.trim()).find((d) => d.startsWith("script-src"));
  // Phase 38: only the two sign-in scripts (Google, Apple) are allowed besides SIRAJ itself. No unsafe-inline, no unsafe-eval.
  assert.equal(script, "script-src 'self' https://accounts.google.com/gsi/client https://appleid.cdn-apple.com");
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /base-uri 'self'/);
  assert.doesNotMatch(csp, /unsafe-eval/);
});

test("Google / Apple sign-in popups are allowed to talk back to the page", () => {
  assert.equal(vercelHeaders["Cross-Origin-Opener-Policy"], "same-origin-allow-popups");
  const csp = vercelHeaders["Content-Security-Policy"];
  assert.match(csp, /frame-src https:\/\/accounts\.google\.com\/gsi\//);
  assert.match(csp, /style-src [^;]*https:\/\/accounts\.google\.com\/gsi\/style/);
});

test("microphone and location stay allowed for SIRAJ itself (Recitation, Qibla, Prayer)", () => {
  const policy = vercelHeaders["Permissions-Policy"];
  assert.match(policy, /microphone=\(self\)/);
  assert.match(policy, /geolocation=\(self\)/);
  assert.match(policy, /camera=\(\)/);
});

test("built files are cached long, the service worker is always re-checked", () => {
  const cache = (src) => vercel.headers.find((h) => h.source === src).headers[0].value;
  assert.match(cache("/assets/(.*)"), /immutable/);
  assert.equal(cache("/sw.js"), "no-cache");
});

test("the single-page rewrite still exists", () => {
  assert.equal(vercel.rewrites[0].destination, "/index.html");
});

// ---- Phase 23: the nginx image must carry the same headers as Vercel / Netlify ----
test("security-headers.inc.template (Docker/nginx) matches vercel.json, apart from the extra API address", () => {
  const inc = readFileSync(root("security-headers.inc.template"), "utf8");
  const nginxHeaders = {};
  for (const m of inc.matchAll(/add_header ([A-Za-z-]+) "(.*)" always;/g)) nginxHeaders[m[1]] = m[2].replace(" ${API_ORIGIN}", "");
  assert.deepEqual(nginxHeaders, vercelHeaders);
});

test("nginx.conf: single-page fallback, long cache for assets, service worker not cached", () => {
  const conf = readFileSync(root("nginx.conf"), "utf8");
  assert.match(conf, /try_files \$uri \$uri\/ \/index\.html;/);
  assert.match(conf, /location \/assets\/[\s\S]*immutable/);
  assert.match(conf, /location = \/sw\.js[\s\S]*no-cache/);
  assert.equal((conf.match(/security-headers\.inc/g) || []).length >= 3, true); // every location
});
