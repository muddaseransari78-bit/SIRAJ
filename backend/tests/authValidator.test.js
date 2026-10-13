// Phase 22 - tests for register / login validation (Zod) and the validate() middleware.
const test = require("node:test");
const assert = require("node:assert");
const { registerSchema, loginSchema, validate } = require("../validators/authValidator");

const good = { name: "Ahmad Ali", email: "ahmad@example.com", password: "Noor-Light-2026" };

test("register: a good body passes and is trimmed", () => {
  const r = registerSchema.safeParse({ ...good, name: "  Ahmad Ali  ", email: "  ahmad@example.com " });
  assert.strictEqual(r.success, true);
  assert.strictEqual(r.data.name, "Ahmad Ali");
  assert.strictEqual(r.data.email, "ahmad@example.com");
});

test("register: short name, bad email, missing fields are refused", () => {
  assert.strictEqual(registerSchema.safeParse({ ...good, name: "A" }).success, false);
  assert.strictEqual(registerSchema.safeParse({ ...good, email: "not-an-email" }).success, false);
  assert.strictEqual(registerSchema.safeParse({ name: "Ahmad" }).success, false);
  assert.strictEqual(registerSchema.safeParse({}).success, false);
});

test("register: weak passwords are refused with a message on the password field", () => {
  for (const password of ["short1", "onlyletterslong", "12345678901234", "password123"]) {
    const r = registerSchema.safeParse({ ...good, password });
    assert.strictEqual(r.success, false, `should refuse ${password}`);
    assert.ok(r.error.issues.some((i) => i.path[0] === "password"));
  }
});

test("register: an enormous password is refused (protects bcrypt)", () => {
  assert.strictEqual(registerSchema.safeParse({ ...good, password: "a1".repeat(500) }).success, false);
});

test("register: non-string values are refused", () => {
  assert.strictEqual(registerSchema.safeParse({ ...good, email: { $gt: "" } }).success, false);
  assert.strictEqual(registerSchema.safeParse({ ...good, password: 12345678 }).success, false);
});

test("login: does not apply strength rules, but needs a password and a valid email", () => {
  assert.strictEqual(loginSchema.safeParse({ email: "a@b.co", password: "x" }).success, true);
  assert.strictEqual(loginSchema.safeParse({ email: "a@b.co", password: "" }).success, false);
  assert.strictEqual(loginSchema.safeParse({ email: "nope", password: "x" }).success, false);
  assert.strictEqual(loginSchema.safeParse({ email: "a@b.co", password: "x".repeat(1000) }).success, false);
});

test("login: a NoSQL-injection object in email is refused", () => {
  assert.strictEqual(loginSchema.safeParse({ email: { $ne: null }, password: "x" }).success, false);
});

test("validate(): failure answers 400 with a list of field errors and does not call next", () => {
  let status = null; let body = null; let nextCalled = false;
  const res = { status(c) { status = c; return this; }, json(b) { body = b; return this; } };
  validate(registerSchema)({ body: { name: "A", email: "x", password: "y" } }, res, () => { nextCalled = true; });
  assert.strictEqual(status, 400);
  assert.strictEqual(body.success, false);
  assert.ok(Array.isArray(body.errors) && body.errors.length >= 3);
  assert.ok(body.errors.every((e) => e.field && e.message));
  assert.strictEqual(nextCalled, false);
});

test("validate(): success replaces req.body with the cleaned data and drops unknown fields", () => {
  const req = { body: { ...good, role: "SUPER_ADMIN", isAdmin: true } };
  let nextCalled = false;
  validate(registerSchema)(req, {}, () => { nextCalled = true; });
  assert.strictEqual(nextCalled, true);
  assert.strictEqual(req.body.role, undefined);   // nobody can register themselves as admin
  assert.strictEqual(req.body.isAdmin, undefined);
});
