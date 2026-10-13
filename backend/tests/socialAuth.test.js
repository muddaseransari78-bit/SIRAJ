// Phase 38 - Google / Apple sign-in checks, without a network and without MongoDB.
const test = require("node:test");
const assert = require("node:assert");
const crypto = require("node:crypto");
const jwt = require("jsonwebtoken");
const { verifyIdToken } = require("../utils/jwks");
const social = require("../services/socialAuthService");

const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: "jwk" }), kid: "test-key", alg: "RS256", use: "sig" };
const getKeys = async () => [jwk];

const sign = (claims, opts = {}) =>
  jwt.sign(claims, privateKey, { algorithm: "RS256", keyid: "test-key", expiresIn: "10m", ...opts });

const GOOGLE_ENV = { GOOGLE_CLIENT_ID: "my-client.apps.googleusercontent.com" };
const APPLE_ENV = { APPLE_CLIENT_ID: "com.siraj.web" };

test("a good Google token is accepted and gives the profile", async () => {
  const token = sign({ sub: "g-1", email: "Ali@Example.com", email_verified: true, name: "Ali Khan", nonce: "abcdefgh1234" }, {
    audience: GOOGLE_ENV.GOOGLE_CLIENT_ID, issuer: "https://accounts.google.com",
  });
  const p = await social.profileFromGoogle({ credential: token, nonce: "abcdefgh1234" }, GOOGLE_ENV, getKeys);
  assert.strictEqual(p.provider, "google");
  assert.strictEqual(p.subject, "g-1");
  assert.strictEqual(p.email, "ali@example.com");
});

test("a token made for ANOTHER app (wrong audience) is refused", async () => {
  const token = sign({ sub: "g-1", email: "a@b.com", email_verified: true, nonce: "abcdefgh1234" }, {
    audience: "someone-elses-client", issuer: "https://accounts.google.com",
  });
  await assert.rejects(social.profileFromGoogle({ credential: token, nonce: "abcdefgh1234" }, GOOGLE_ENV, getKeys), /Invalid/);
});

test("a wrong issuer, an expired token and a token signed with another key are refused", async () => {
  const base = { sub: "g-1", email: "a@b.com", email_verified: true, nonce: "abcdefgh1234" };
  const badIssuer = sign(base, { audience: GOOGLE_ENV.GOOGLE_CLIENT_ID, issuer: "https://evil.example" });
  await assert.rejects(social.profileFromGoogle({ credential: badIssuer, nonce: "abcdefgh1234" }, GOOGLE_ENV, getKeys));
  const expired = sign(base, { audience: GOOGLE_ENV.GOOGLE_CLIENT_ID, issuer: "https://accounts.google.com", expiresIn: -60 });
  await assert.rejects(social.profileFromGoogle({ credential: expired, nonce: "abcdefgh1234" }, GOOGLE_ENV, getKeys));
  const other = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey;
  const forged = jwt.sign(base, other, { algorithm: "RS256", keyid: "test-key", expiresIn: "10m", audience: GOOGLE_ENV.GOOGLE_CLIENT_ID, issuer: "https://accounts.google.com" });
  await assert.rejects(social.profileFromGoogle({ credential: forged, nonce: "abcdefgh1234" }, GOOGLE_ENV, getKeys));
});

test("an unsigned token (alg none) and garbage are refused", async () => {
  const none = `${Buffer.from('{"alg":"none"}').toString("base64url")}.${Buffer.from('{"sub":"x"}').toString("base64url")}.`;
  await assert.rejects(verifyIdToken(none, { jwksUrl: "x", audience: "a", issuer: "b", getKeys }));
  await assert.rejects(verifyIdToken("not-a-token-at-all-but-long-enough", { jwksUrl: "x", audience: "a", issuer: "b", getKeys }));
  await assert.rejects(verifyIdToken("", { jwksUrl: "x", audience: "a", issuer: "b", getKeys }));
});

test("the nonce must match (copied as it is, or as SHA-256)", async () => {
  assert.ok(social.nonceMatches("abc12345", "abc12345"));
  assert.ok(social.nonceMatches(crypto.createHash("sha256").update("abc12345").digest("hex"), "abc12345"));
  assert.ok(!social.nonceMatches("other", "abc12345"));
  assert.ok(!social.nonceMatches(undefined, "abc12345"));
  assert.ok(!social.nonceMatches("abc12345", ""));
  const token = sign({ sub: "g-1", email: "a@b.com", email_verified: true, nonce: "replayed-nonce" }, {
    audience: GOOGLE_ENV.GOOGLE_CLIENT_ID, issuer: "https://accounts.google.com",
  });
  await assert.rejects(social.profileFromGoogle({ credential: token, nonce: "my-own-nonce-1" }, GOOGLE_ENV, getKeys), /could not be verified/);
});

test("a Google email that is not verified is refused", async () => {
  const token = sign({ sub: "g-2", email: "a@b.com", email_verified: false, nonce: "abcdefgh1234" }, {
    audience: GOOGLE_ENV.GOOGLE_CLIENT_ID, issuer: "https://accounts.google.com",
  });
  await assert.rejects(social.profileFromGoogle({ credential: token, nonce: "abcdefgh1234" }, GOOGLE_ENV, getKeys), /not verified/);
});

test("Apple: good token works, email_verified may be the text 'true', name comes from the browser", async () => {
  const token = sign({ sub: "a-1", email: "x@privaterelay.appleid.com", email_verified: "true", nonce: "abcdefgh1234" }, {
    audience: APPLE_ENV.APPLE_CLIENT_ID, issuer: "https://appleid.apple.com",
  });
  const p = await social.profileFromApple({ credential: token, nonce: "abcdefgh1234", name: "Sara Ahmed" }, APPLE_ENV, getKeys);
  assert.strictEqual(p.provider, "apple");
  assert.strictEqual(p.emailVerified, true);
  assert.strictEqual(p.name, "Sara Ahmed");
});

test("a provider that is not configured answers 501 instead of crashing", async () => {
  await assert.rejects(social.profileFromGoogle({ credential: "x".repeat(30), nonce: "abcdefgh1234" }, {}, getKeys), (e) => e.statusCode === 501);
  await assert.rejects(social.profileFromApple({ credential: "x".repeat(30), nonce: "abcdefgh1234" }, {}, getKeys), (e) => e.statusCode === 501);
  assert.deepStrictEqual(social.providers({}), { google: false, apple: false });
  assert.deepStrictEqual(social.providers({ GOOGLE_CLIENT_ID: "a" }), { google: true, apple: false });
});

test("names are cleaned and have a safe fallback", () => {
  assert.strictEqual(social.cleanName("  Ali   Khan ", "a@b.com"), "Ali Khan");
  assert.strictEqual(social.cleanName("", "bilal.ahmed@mail.com"), "bilal.ahmed");
  assert.strictEqual(social.cleanName("x", "q@mail.com"), "SIRAJ User"); // too short everywhere -> safe default
  assert.ok(social.cleanName("a".repeat(200), "a@b.com").length <= 80);
});

test("routes: google and apple are rate limited and validated; refresh renews the cookie", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const routes = fs.readFileSync(path.join(__dirname, "../routes/authRoutes.js"), "utf8").split("\n");
  for (const name of ["/google", "/apple"]) {
    const l = routes.find((x) => x.includes(`"${name}"`));
    assert.match(l, /authLimiter/);
    assert.match(l, /validate\(/);
  }
  const ctl = fs.readFileSync(path.join(__dirname, "../controllers/authController.js"), "utf8");
  assert.match(ctl, /refreshToken, REFRESH_COOKIE_OPTIONS\); \/\/ renew/);
});
