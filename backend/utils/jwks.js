// Verifies an ID token (a signed JWT) from Google or Apple using the provider's PUBLIC signing keys (JWKS).
// No extra npm package: Node's own crypto turns a JWK into a key, jsonwebtoken checks signature, audience, issuer and expiry.
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const axios = require("axios");

const KEY_TTL_MS = 60 * 60 * 1000; // provider keys change rarely: keep them for one hour
const cache = new Map(); // url -> { keys, at }

async function loadKeys(url, force = false) {
  const hit = cache.get(url);
  if (!force && hit && Date.now() - hit.at < KEY_TTL_MS) return hit.keys;
  const res = await axios.get(url, { timeout: 8000 });
  const keys = res.data && res.data.keys;
  if (!Array.isArray(keys) || !keys.length) throw new Error("The sign-in provider returned no keys");
  cache.set(url, { keys, at: Date.now() });
  return keys;
}

function fail(message) {
  const err = new Error(message);
  err.statusCode = 401;
  return err;
}

/**
 * @param {string} token       the ID token from the browser
 * @param {{jwksUrl:string, audience:string, issuer:string|string[], getKeys?:Function}} opts
 *        getKeys(url, force) can be replaced in tests
 * @returns the verified token claims
 */
async function verifyIdToken(token, { jwksUrl, audience, issuer, getKeys = loadKeys }) {
  if (typeof token !== "string" || token.length < 20 || token.length > 8192) throw fail("Invalid sign-in token");
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || !decoded.header || decoded.header.alg !== "RS256" || !decoded.header.kid) throw fail("Invalid sign-in token");

  let keys = await getKeys(jwksUrl, false);
  let jwk = keys.find((k) => k.kid === decoded.header.kid);
  if (!jwk) {
    keys = await getKeys(jwksUrl, true); // the provider may have rotated its keys
    jwk = keys.find((k) => k.kid === decoded.header.kid);
  }
  if (!jwk) throw fail("Invalid sign-in token");

  try {
    const key = crypto.createPublicKey({ key: jwk, format: "jwk" });
    return jwt.verify(token, key, { algorithms: ["RS256"], audience, issuer });
  } catch (e) {
    throw fail("Invalid or expired sign-in token");
  }
}

module.exports = { verifyIdToken, loadKeys };
