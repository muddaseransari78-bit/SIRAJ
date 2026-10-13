// Phase 22 - tests for the security / error plumbing: auth, role guard, error handler,
// API response shape and async handler. No database or network is needed.
// The token is signed by hand (HS256) so the test checks the REAL jsonwebtoken library.
const test = require("node:test");
const assert = require("node:assert");
const crypto = require("node:crypto");

process.env.JWT_ACCESS_SECRET = "test-secret-for-unit-tests";

const { requireAuth, optionalAuth } = require("../middleware/auth");
const roleGuard = require("../middleware/roleGuard");
const { errorHandler, notFound } = require("../middleware/errorHandler");
const { sendSuccess, sendError } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");
const httpError = require("../utils/httpError");

const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
function makeToken(payload, secret = process.env.JWT_ACCESS_SECRET, expiresInSec = 600) {
  const head = b64({ alg: "HS256", typ: "JWT" });
  const body = b64({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + expiresInSec });
  const sig = crypto.createHmac("sha256", secret).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}

// A tiny fake of Express's res/next so we can see what a middleware did.
function fakeRes() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; },
  };
}
function run(mw, req) {
  const res = fakeRes();
  let nextCalled = false;
  let nextArg;
  mw(req, res, (arg) => { nextCalled = true; nextArg = arg; });
  return { res, nextCalled, nextArg };
}

test("requireAuth: no header -> 401", () => {
  const { res, nextCalled } = run(requireAuth, { headers: {} });
  assert.strictEqual(res.statusCode, 401);
  assert.strictEqual(res.body.success, false);
  assert.strictEqual(nextCalled, false);
});

test("requireAuth: wrong scheme (Basic) -> 401", () => {
  const { res, nextCalled } = run(requireAuth, { headers: { authorization: "Basic abc" } });
  assert.strictEqual(res.statusCode, 401);
  assert.strictEqual(nextCalled, false);
});

test("requireAuth: valid token -> next() and req.user has id and role", () => {
  const req = { headers: { authorization: `Bearer ${makeToken({ id: "u1", role: "USER" })}` } };
  const { nextCalled, res } = run(requireAuth, req);
  assert.strictEqual(nextCalled, true);
  assert.strictEqual(res.statusCode, null);
  assert.strictEqual(req.user.id, "u1");
  assert.strictEqual(req.user.role, "USER");
});

test("requireAuth: token signed with another secret -> 401", () => {
  const req = { headers: { authorization: `Bearer ${makeToken({ id: "u1", role: "ADMIN" }, "attacker-secret")}` } };
  const { res, nextCalled } = run(requireAuth, req);
  assert.strictEqual(res.statusCode, 401);
  assert.strictEqual(nextCalled, false);
  assert.strictEqual(req.user, undefined);
});

test("requireAuth: expired token -> 401", () => {
  const req = { headers: { authorization: `Bearer ${makeToken({ id: "u1", role: "USER" }, undefined, -60)}` } };
  const { res, nextCalled } = run(requireAuth, req);
  assert.strictEqual(res.statusCode, 401);
  assert.strictEqual(nextCalled, false);
});

test("requireAuth: tampered payload (role changed) -> 401", () => {
  const good = makeToken({ id: "u1", role: "USER" });
  const [h, , s] = good.split(".");
  const evilBody = b64({ id: "u1", role: "SUPER_ADMIN", exp: Math.floor(Date.now() / 1000) + 600 });
  const req = { headers: { authorization: `Bearer ${h}.${evilBody}.${s}` } };
  const { res } = run(requireAuth, req);
  assert.strictEqual(res.statusCode, 401);
});

test("requireAuth: 'alg: none' token is refused", () => {
  const head = b64({ alg: "none", typ: "JWT" });
  const body = b64({ id: "u1", role: "SUPER_ADMIN", exp: Math.floor(Date.now() / 1000) + 600 });
  const req = { headers: { authorization: `Bearer ${head}.${body}.` } };
  const { res, nextCalled } = run(requireAuth, req);
  assert.strictEqual(res.statusCode, 401);
  assert.strictEqual(nextCalled, false);
});

test("optionalAuth: guest passes without a user", () => {
  const req = { headers: {} };
  const { nextCalled } = run(optionalAuth, req);
  assert.strictEqual(nextCalled, true);
  assert.strictEqual(req.user, undefined);
});

test("optionalAuth: bad token still passes, user is null", () => {
  const req = { headers: { authorization: "Bearer not.a.token" } };
  const { nextCalled } = run(optionalAuth, req);
  assert.strictEqual(nextCalled, true);
  assert.strictEqual(req.user, null);
});

test("optionalAuth: good token sets the user", () => {
  const req = { headers: { authorization: `Bearer ${makeToken({ id: "u9", role: "ADMIN" })}` } };
  run(optionalAuth, req);
  assert.strictEqual(req.user.id, "u9");
});

test("roleGuard: no user -> 401", () => {
  const { res, nextCalled } = run(roleGuard(["ADMIN"]), {});
  assert.strictEqual(res.statusCode, 401);
  assert.strictEqual(nextCalled, false);
});

test("roleGuard: USER cannot enter an admin route -> 403", () => {
  const { res, nextCalled } = run(roleGuard(["ADMIN", "SUPER_ADMIN"]), { user: { id: "u1", role: "USER" } });
  assert.strictEqual(res.statusCode, 403);
  assert.strictEqual(nextCalled, false);
});

test("roleGuard: ADMIN and SUPER_ADMIN may enter; ADMIN may not enter a SUPER_ADMIN-only route", () => {
  assert.strictEqual(run(roleGuard(["ADMIN", "SUPER_ADMIN"]), { user: { role: "ADMIN" } }).nextCalled, true);
  assert.strictEqual(run(roleGuard(["ADMIN", "SUPER_ADMIN"]), { user: { role: "SUPER_ADMIN" } }).nextCalled, true);
  const r = run(roleGuard(["SUPER_ADMIN"]), { user: { role: "ADMIN" } });
  assert.strictEqual(r.res.statusCode, 403);
});

test("roleGuard: an empty role list lets nobody in", () => {
  assert.strictEqual(run(roleGuard(), { user: { role: "SUPER_ADMIN" } }).res.statusCode, 403);
});

test("sendSuccess: consistent shape and defaults", () => {
  const res = fakeRes();
  sendSuccess(res, { data: { a: 1 } });
  assert.strictEqual(res.statusCode, 200);
  assert.deepStrictEqual(res.body, { success: true, message: "Success", data: { a: 1 } });
  const created = fakeRes();
  sendSuccess(created, { statusCode: 201, message: "Created" });
  assert.strictEqual(created.statusCode, 201);
  assert.strictEqual(created.body.data, null);
});

test("sendError: hides the 'error' detail in production, shows it in development", () => {
  const old = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "production";
    const a = fakeRes();
    sendError(a, { statusCode: 500, message: "boom", error: "stack here" });
    assert.strictEqual(a.body.success, false);
    assert.strictEqual("error" in a.body, false);

    process.env.NODE_ENV = "development";
    const b = fakeRes();
    sendError(b, { statusCode: 400, message: "bad", error: "details" });
    assert.strictEqual(b.statusCode, 400);
    assert.strictEqual(b.body.error, "details");
  } finally {
    process.env.NODE_ENV = old;
  }
});

test("errorHandler: production hides the message and stack of a 500", () => {
  const old = process.env.NODE_ENV;
  const log = console.error;
  console.error = () => {};
  try {
    process.env.NODE_ENV = "production";
    const res = fakeRes();
    errorHandler(new Error("secret db password is hunter2"), { method: "GET", originalUrl: "/api/x" }, res, () => {});
    assert.strictEqual(res.statusCode, 500);
    assert.strictEqual(res.body.message, "Internal server error");
    assert.ok(!JSON.stringify(res.body).includes("hunter2"));
    assert.ok(!("error" in res.body));
  } finally {
    process.env.NODE_ENV = old;
    console.error = log;
  }
});

test("errorHandler: a 4xx keeps its own message, also in production", () => {
  const old = process.env.NODE_ENV;
  const log = console.error;
  console.error = () => {};
  try {
    process.env.NODE_ENV = "production";
    const res = fakeRes();
    errorHandler(httpError(404, "Surah not found"), { method: "GET", originalUrl: "/api/quran/999" }, res, () => {});
    assert.strictEqual(res.statusCode, 404);
    assert.strictEqual(res.body.message, "Surah not found");
  } finally {
    process.env.NODE_ENV = old;
    console.error = log;
  }
});

test("errorHandler: Mongoose CastError / ValidationError become 400, not 500", () => {
  const log = console.error;
  console.error = () => {};
  try {
    const cast = Object.assign(new Error("Cast to Number failed for value \"abc\" at path \"surahNumber\""), { name: "CastError", path: "surahNumber" });
    const res = fakeRes();
    errorHandler(cast, { method: "POST", originalUrl: "/api/notes" }, res, () => {});
    assert.strictEqual(res.statusCode, 400);
    assert.match(res.body.message, /surahNumber/);
    assert.ok(!/Cast to Number/.test(res.body.message), "internal wording must not leak");

    const val = Object.assign(new Error("Note validation failed: text: too long"), { name: "ValidationError" });
    const res2 = fakeRes();
    errorHandler(val, { method: "POST", originalUrl: "/api/notes" }, res2, () => {});
    assert.strictEqual(res2.statusCode, 400);
    assert.ok(!/Note validation failed/.test(res2.body.message));
  } finally {
    console.error = log;
  }
});

test("errorHandler: an ordinary Error without a status is still a 500", () => {
  const log = console.error;
  console.error = () => {};
  try {
    const res = fakeRes();
    errorHandler(new Error("real crash"), { method: "GET", originalUrl: "/api/x" }, res, () => {});
    assert.strictEqual(res.statusCode, 500);
  } finally {
    console.error = log;
  }
});

test("notFound: forwards a 404 error that names the route", () => {
  const { nextArg } = run(notFound, { originalUrl: "/api/nope" });
  assert.strictEqual(nextArg.statusCode, 404);
  assert.match(nextArg.message, /\/api\/nope/);
});

test("httpError: sets message and statusCode", () => {
  const e = httpError(409, "Email already used");
  assert.ok(e instanceof Error);
  assert.strictEqual(e.statusCode, 409);
  assert.strictEqual(e.message, "Email already used");
});

test("asyncHandler: a rejected promise reaches next(err); a normal result does not", async () => {
  const boom = new Error("async boom");
  let got = null;
  await asyncHandler(async () => { throw boom; })({}, {}, (e) => { got = e; });
  await new Promise((r) => setImmediate(r));
  assert.strictEqual(got, boom);

  let called = false;
  await asyncHandler(async (req, res) => { res.ok = true; })({}, {}, () => { called = true; });
  await new Promise((r) => setImmediate(r));
  assert.strictEqual(called, false);
});

test("asyncHandler: a synchronous throw is not swallowed silently", () => {
  // Express handles sync throws itself, but asyncHandler must not hide them.
  assert.throws(() => asyncHandler(() => { throw new Error("sync"); })({}, {}, () => {}), /sync/);
});
