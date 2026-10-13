const test = require("node:test");
const assert = require("node:assert/strict");

const { sanitizeValue } = require("../utils/sanitize");
const { passwordProblems } = require("../utils/passwordPolicy");
const { checkEnv } = require("../utils/envCheck");
const { cacheControlFor } = require("../utils/cachePolicy");
const { publicCache, noStore } = require("../middleware/cachePolicy");
const sanitizeInput = require("../middleware/sanitizeInput");

// ---------- sanitize ----------
test("sanitize removes Mongo operators and dotted keys", () => {
  const dirty = { email: { $gt: "" }, name: "Ali", "a.b": 1, nested: { $where: "x", ok: true } };
  assert.deepEqual(sanitizeValue(dirty), { email: {}, name: "Ali", nested: { ok: true } });
});

test("sanitize keeps normal data (text, numbers, arrays) unchanged", () => {
  const clean = { q: "sabr", page: 3, tags: ["a", "b"], flag: false, list: [{ x: 1 }] };
  assert.deepEqual(sanitizeValue(clean), clean);
});

test("sanitize removes prototype-pollution keys", () => {
  const dirty = JSON.parse('{"__proto__": {"admin": true}, "constructor": {"x": 1}, "ok": 1}');
  const result = sanitizeValue(dirty);
  assert.deepEqual(result, { ok: 1 });
  assert.equal({}.admin, undefined);
});

test("sanitize does not change the original object and cuts very deep nesting", () => {
  const original = { a: { $ne: 1 } };
  sanitizeValue(original);
  assert.deepEqual(original, { a: { $ne: 1 } });
  let deep = { v: 1 };
  for (let i = 0; i < 30; i++) deep = { x: deep };
  assert.ok(JSON.stringify(sanitizeValue(deep)).length < JSON.stringify(deep).length);
});

test("sanitizeInput middleware cleans body, query and params", () => {
  const req = { body: { email: { $gt: "" } }, query: { q: { $ne: "x" }, page: "2" }, params: { id: "5" } };
  let called = false;
  sanitizeInput(req, {}, () => { called = true; });
  assert.equal(called, true);
  assert.deepEqual(req.body, { email: {} });
  assert.deepEqual(req.query, { q: {}, page: "2" });
  assert.deepEqual(req.params, { id: "5" });
});

// ---------- password policy ----------
test("a good password has no problems", () => {
  assert.deepEqual(passwordProblems("Noor2026Light", { email: "ali@example.com" }), []);
});

test("short, letters-only, numbers-only, too long", () => {
  assert.ok(passwordProblems("ab1").some((p) => /at least 8/.test(p)));
  assert.ok(passwordProblems("onlyletters").some((p) => /number/.test(p)));
  assert.ok(passwordProblems("12345678901").some((p) => /letter/.test(p)));
  assert.ok(passwordProblems("a1".repeat(70)).some((p) => /at most 128/.test(p)));
});

test("common passwords and passwords containing the email name are refused", () => {
  assert.ok(passwordProblems("Password123").some((p) => /common/.test(p)));
  assert.ok(passwordProblems("zainab2026!", { email: "zainab@example.com" }).some((p) => /email name/.test(p)));
  assert.deepEqual(passwordProblems("zain2026!x", { email: "z@example.com" }), []); // very short email names are ignored
});

test("Urdu / Arabic letters count as letters", () => {
  assert.deepEqual(passwordProblems("سراج12345"), []);
});

test("non-string password is handled", () => {
  assert.ok(passwordProblems(undefined).length > 0);
  assert.ok(passwordProblems({ $gt: "" }).length > 0);
});

// ---------- env check ----------
const goodSecrets = { JWT_ACCESS_SECRET: "a".repeat(40), JWT_REFRESH_SECRET: "b".repeat(40), MONGO_URI: "mongodb://x" };

test("missing values are always errors", () => {
  const { errors } = checkEnv({ NODE_ENV: "development" });
  assert.match(errors[0], /MONGO_URI, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET/);
});

test("placeholder secrets: warning in development, error in production", () => {
  const env = { ...goodSecrets, JWT_ACCESS_SECRET: "replace_this_with_a_long_random_string" };
  assert.equal(checkEnv({ ...env, NODE_ENV: "development" }).errors.length, 0);
  assert.ok(checkEnv({ ...env, NODE_ENV: "development" }).warnings.length > 0);
  assert.ok(checkEnv({ ...env, NODE_ENV: "production" }).errors.length > 0);
});

test("short or identical secrets are rejected in production", () => {
  assert.ok(checkEnv({ ...goodSecrets, JWT_REFRESH_SECRET: "short", NODE_ENV: "production" }).errors.some((e) => /too short/.test(e)));
  assert.ok(checkEnv({ ...goodSecrets, JWT_REFRESH_SECRET: goodSecrets.JWT_ACCESS_SECRET, NODE_ENV: "production" }).errors.some((e) => /different/.test(e)));
});

test("a good production setup passes; proxy/localhost give warnings only", () => {
  const ok = checkEnv({ ...goodSecrets, NODE_ENV: "production", CLIENT_URL: "https://siraj.example.com", TRUST_PROXY: "1" });
  assert.deepEqual(ok, { errors: [], warnings: [] });
  const warn = checkEnv({ ...goodSecrets, NODE_ENV: "production", CLIENT_URL: "http://localhost:5173" });
  assert.equal(warn.errors.length, 0);
  assert.ok(warn.warnings.length >= 2);
});

// ---------- cache policy ----------
test("guest GET of public content is cacheable", () => {
  assert.equal(cacheControlFor({ method: "GET", headers: {} }, { maxAge: 3600, swr: 1800 }), "public, max-age=3600, stale-while-revalidate=1800");
});

test("logged-in requests and writes are never cached", () => {
  assert.equal(cacheControlFor({ method: "GET", headers: { authorization: "Bearer x" } }, { maxAge: 3600 }), "no-store");
  assert.equal(cacheControlFor({ method: "POST", headers: {} }, { maxAge: 3600 }), "no-store");
  assert.equal(cacheControlFor({ method: "GET", headers: {} }, { maxAge: 0 }), "no-store");
});

function fakeRes() {
  const headers = {};
  return { headers, set(k, v) { headers[k] = v; }, vary(v) { headers.Vary = v; } };
}

test("publicCache middleware sets Cache-Control + Vary and skips listed paths", () => {
  const res = fakeRes();
  publicCache(3600, { skipPaths: ["/today"] })({ method: "GET", headers: {}, path: "/collections" }, res, () => {});
  assert.match(res.headers["Cache-Control"], /^public, max-age=3600/);
  assert.equal(res.headers.Vary, "Authorization");

  const today = fakeRes();
  let nextCalled = false;
  publicCache(3600, { skipPaths: ["/today"] })({ method: "GET", headers: {}, path: "/today" }, today, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
  assert.equal(today.headers["Cache-Control"], undefined);
});

test("noStore middleware sets no-store", () => {
  const res = fakeRes();
  noStore({}, res, () => {});
  assert.equal(res.headers["Cache-Control"], "no-store");
});
