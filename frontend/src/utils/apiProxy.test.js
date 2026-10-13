import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = (p) => fileURLToPath(new URL(`../../${p}`, import.meta.url));
const vercel = JSON.parse(readFileSync(root("vercel.json"), "utf8"));

test("vercel.json passes /api to the backend, after the SPA rewrite (which skips /api/)", () => {
  const spa = vercel.rewrites[0];
  assert.equal(spa.destination, "/index.html");
  assert.ok(new RegExp(`^${spa.source}$`).test("/quran/2"));
  assert.ok(!new RegExp(`^${spa.source}$`).test("/api/auth/login"), "SPA rewrite must not swallow /api");
  const proxy = vercel.rewrites.find((r) => r.source === "/api/:path*");
  assert.ok(proxy, "no /api proxy rewrite");
  assert.match(proxy.destination, /^https:\/\/.+\/api\/:path\*$/);
});

test("render.yaml matches the same-address setup (lax cookie, two proxies)", () => {
  const yaml = readFileSync(root("../render.yaml"), "utf8");
  assert.match(yaml, /key: COOKIE_SAMESITE\s+value: lax/);
  assert.match(yaml, /key: TRUST_PROXY\s+value: "2"/);
});
