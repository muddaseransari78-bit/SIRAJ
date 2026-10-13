// Google and Apple sign-in. The browser gets an ID token from Google / Apple, sends it here, and this file:
//   1. checks the token (signature, audience = OUR client id, issuer, expiry, nonce),
//   2. finds the SIRAJ account (by provider id, then by the same verified email) or creates a new one,
//   3. hands back the same { user, accessToken, refreshToken } as a normal email login.
const crypto = require("crypto");
const User = require("../models/User");
const UserPreferences = require("../models/UserPreferences");
const authService = require("./authService");
const { verifyIdToken } = require("../utils/jwks");

const GOOGLE_JWKS = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
const APPLE_JWKS = "https://appleid.apple.com/auth/keys";
const APPLE_ISSUER = "https://appleid.apple.com";

const FIELD = { google: "googleId", apple: "appleId" };

function httpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

/** Which providers are switched on (client id present in backend/.env). */
function providers(env = process.env) {
  return { google: !!(env.GOOGLE_CLIENT_ID || "").trim(), apple: !!(env.APPLE_CLIENT_ID || "").trim() };
}

// The browser puts a random nonce into the sign-in request; the provider copies it into the token.
// Apple / Google may copy it as it is or as its SHA-256 hex, so both are accepted.
function nonceMatches(claim, nonce) {
  if (!claim || !nonce) return false;
  if (claim === nonce) return true;
  return claim === crypto.createHash("sha256").update(nonce).digest("hex");
}

const isTrue = (v) => v === true || v === "true";

function cleanName(raw, email) {
  const name = String(raw || "").replace(/\s+/g, " ").trim().slice(0, 80);
  if (name.length >= 2) return name;
  const local = String(email || "").split("@")[0].replace(/[^\p{L}\p{N}._-]/gu, "").slice(0, 40);
  return local.length >= 2 ? local : "SIRAJ User";
}

async function profileFromGoogle({ credential, nonce }, env = process.env, getKeys) {
  const audience = (env.GOOGLE_CLIENT_ID || "").trim();
  if (!audience) throw httpError(501, "Google sign-in is not switched on");
  const claims = await verifyIdToken(credential, { jwksUrl: GOOGLE_JWKS, audience, issuer: GOOGLE_ISSUERS, getKeys });
  if (!nonceMatches(claims.nonce, nonce)) throw httpError(401, "Sign-in could not be verified. Please try again.");
  if (!claims.email || !isTrue(claims.email_verified)) throw httpError(400, "Your Google email address is not verified");
  return {
    provider: "google",
    subject: String(claims.sub),
    email: String(claims.email).toLowerCase(),
    name: claims.name,
    picture: typeof claims.picture === "string" && /^https:\/\//.test(claims.picture) ? claims.picture.slice(0, 500) : null,
  };
}

async function profileFromApple({ credential, nonce, name }, env = process.env, getKeys) {
  const audience = (env.APPLE_CLIENT_ID || "").trim();
  if (!audience) throw httpError(501, "Apple sign-in is not switched on");
  const claims = await verifyIdToken(credential, { jwksUrl: APPLE_JWKS, audience, issuer: APPLE_ISSUER, getKeys });
  if (!nonceMatches(claims.nonce, nonce)) throw httpError(401, "Sign-in could not be verified. Please try again.");
  const email = claims.email ? String(claims.email).toLowerCase() : "";
  return {
    provider: "apple",
    subject: String(claims.sub),
    email,
    emailVerified: isTrue(claims.email_verified),
    name, // Apple sends the name only the very first time, and only to the browser
    picture: null,
  };
}

/**
 * Finds / links / creates the account for a verified provider profile.
 * allowSignup=false (Admin closed registrations) still lets existing users in.
 */
async function signInWithProfile(profile, { allowSignup = true } = {}) {
  const field = FIELD[profile.provider];
  let user = await User.findOne({ [field]: profile.subject });

  // Same person, first time with this provider: link it to the account that has the same (verified) email
  if (!user && profile.email && profile.emailVerified !== false) {
    user = await User.findOne({ email: profile.email });
    if (user) {
      user[field] = profile.subject;
      if (!user.profilePicture && profile.picture) user.profilePicture = profile.picture;
      await user.save();
    }
  }

  if (!user) {
    if (!allowSignup) throw httpError(403, "New registrations are closed right now");
    if (!profile.email) throw httpError(400, "We did not get an email address from your account. Please sign up with email.");
    user = await User.create({
      name: cleanName(profile.name, profile.email),
      email: profile.email,
      [field]: profile.subject,
      authProvider: profile.provider,
      profilePicture: profile.picture || null,
    });
    await UserPreferences.create({ user: user._id });
  }

  if (!user.isActive) throw httpError(403, "This account has been deactivated");

  return {
    user: authService.sanitizeUser(user),
    accessToken: authService.signAccessToken(user),
    refreshToken: authService.signRefreshToken(user),
  };
}

async function googleSignIn(body, opts) {
  return signInWithProfile(await profileFromGoogle(body), opts);
}
async function appleSignIn(body, opts) {
  return signInWithProfile(await profileFromApple(body), opts);
}

module.exports = {
  providers, nonceMatches, cleanName, profileFromGoogle, profileFromApple, signInWithProfile, googleSignIn, appleSignIn,
};
