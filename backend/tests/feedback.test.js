// Phase 30 - feedback form checks on the server (no database needed).
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { validateFeedback, cleanText, TYPES, FEATURES, MAX_TEXT } = require("../utils/feedbackValidate");

const good = () => ({ type: "general", ratings: { overall: 5 }, recommend: "yes" });

test("a minimal feedback (overall rating + recommend) is accepted", () => {
  const { value, error } = validateFeedback(good());
  assert.strictEqual(error, undefined);
  assert.deepStrictEqual(value.ratings, { overall: 5 });
  assert.deepStrictEqual(value.features, []);
  assert.strictEqual(value.improve, "");
});

test("type defaults to general; unknown types are refused", () => {
  const b = good(); delete b.type;
  assert.strictEqual(validateFeedback(b).value.type, "general");
  assert.ok(validateFeedback({ ...good(), type: "spam" }).error);
  for (const t of TYPES) assert.ok(validateFeedback({ ...good(), type: t, improve: "this is a long enough text" }).value);
});

test("overall rating is required and must be a whole number 1-5", () => {
  for (const bad of [undefined, 0, 6, 2.5, "5", null, NaN]) {
    assert.ok(validateFeedback({ ...good(), ratings: { overall: bad } }).error, `overall=${bad}`);
  }
  assert.ok(validateFeedback({ type: "general", recommend: "yes" }).error);
});

test("optional ratings are checked only when given", () => {
  assert.deepStrictEqual(validateFeedback({ ...good(), ratings: { overall: 4, ease: 3, quran: 5, audio: 1 } }).value.ratings, { overall: 4, ease: 3, quran: 5, audio: 1 });
  assert.ok(validateFeedback({ ...good(), ratings: { overall: 4, audio: 9 } }).error);
  assert.deepStrictEqual(validateFeedback({ ...good(), ratings: { overall: 4, ease: "" } }).value.ratings, { overall: 4 });
});

test("recommend must be yes, maybe or no", () => {
  for (const r of ["yes", "maybe", "no"]) assert.ok(validateFeedback({ ...good(), recommend: r }).value);
  assert.ok(validateFeedback({ ...good(), recommend: "perhaps" }).error);
  const b = good(); delete b.recommend;
  assert.ok(validateFeedback(b).error);
});

test("features: known ids only, duplicates removed, must be a list", () => {
  assert.deepStrictEqual(validateFeedback({ ...good(), features: ["quran", "audio", "quran"] }).value.features, ["quran", "audio"]);
  assert.ok(validateFeedback({ ...good(), features: ["quran", "hacking"] }).error);
  assert.ok(validateFeedback({ ...good(), features: "quran" }).error);
  assert.ok(FEATURES.includes("ramadan") && FEATURES.includes("calendar") && FEATURES.includes("topics") && FEATURES.includes("sourceFinder") && FEATURES.includes("mushaf"));
});

test("text answers are cleaned and limited", () => {
  assert.strictEqual(cleanText("  hello \u0000  world \n\n\n\n ok  "), "hello world \n\n ok");
  assert.strictEqual(cleanText(42), "");
  assert.ok(validateFeedback({ ...good(), improve: "x".repeat(MAX_TEXT + 1) }).error);
  assert.ok(validateFeedback({ ...good(), newFeature: "x".repeat(MAX_TEXT) }).value);
});

test("bug and content reports need a description", () => {
  assert.ok(validateFeedback({ ...good(), type: "bug" }).error);
  assert.ok(validateFeedback({ ...good(), type: "content", improve: "short" }).error);
  assert.ok(validateFeedback({ ...good(), type: "bug", improve: "The audio stops at ayah 5" }).value);
});

test("non-object bodies are refused", () => {
  for (const b of [null, undefined, "text", 5, []]) assert.ok(validateFeedback(b).error);
});

test("feedback route file: login guard first, rate limiter on the POST, user id taken from the token", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "routes", "feedbackRoutes.js"), "utf8");
  assert.match(src, /router\.use\(requireAuth\)/);
  assert.match(src, /router\.post\("\/",\s*feedbackLimiter/);
  const ctl = fs.readFileSync(path.join(__dirname, "..", "controllers", "feedbackController.js"), "utf8");
  assert.match(ctl, /user: req\.user\.id/);
  assert.ok(!/req\.body\.user/.test(ctl), "the user must never come from the request body");
});

test("admin feedback routes sit inside the admin-guarded router", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "routes", "adminRoutes.js"), "utf8");
  assert.ok(src.indexOf('router.use(requireAuth, roleGuard(["ADMIN", "SUPER_ADMIN"]))') < src.indexOf("feedbackCtl.adminList"));
});
