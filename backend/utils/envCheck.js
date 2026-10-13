// Checks backend/.env at start-up (Phase 20 - security). Pure function: pass in process.env.
// Returns { errors, warnings }. In production, errors stop the server; in development they only warn.

const REQUIRED = ["MONGO_URI", "JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"];
const MIN_SECRET_LENGTH = 32;

function looksLikePlaceholder(value) {
  return /replace_this|changeme|your[_-]?secret|example|secret123/i.test(value);
}

function checkEnv(env) {
  const errors = [];
  const warnings = [];
  const production = env.NODE_ENV === "production";

  const missing = REQUIRED.filter((name) => !env[name]);
  if (missing.length) errors.push(`Missing in backend/.env: ${missing.join(", ")}`);

  for (const name of ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"]) {
    const value = env[name];
    if (!value) continue;
    if (looksLikePlaceholder(value)) {
      (production ? errors : warnings).push(`${name} still has the example text. Use a long random value.`);
    } else if (value.length < MIN_SECRET_LENGTH) {
      (production ? errors : warnings).push(`${name} is too short (use at least ${MIN_SECRET_LENGTH} characters).`);
    }
  }

  if (env.JWT_ACCESS_SECRET && env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
    (production ? errors : warnings).push("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different.");
  }

  // Phase 31: background prayer reminders need BOTH VAPID keys (they are optional - without them only in-page reminders work)
  if (!!env.VAPID_PUBLIC_KEY !== !!env.VAPID_PRIVATE_KEY) {
    warnings.push("Only one of VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY is set. Background prayer reminders need both (npm run vapid).");
  }
  if (env.CRON_SECRET && env.CRON_SECRET.length < 16) {
    warnings.push("CRON_SECRET is short. Use at least 16 random characters (npm run vapid prints one).");
  }

  if (production) {
    const client = env.CLIENT_URL || "";
    if (!client) warnings.push("CLIENT_URL is empty. Set it to your real frontend address (CORS).");
    if (/localhost|127\.0\.0\.1/.test(client)) warnings.push("CLIENT_URL still points to localhost.");
    if (!Number(env.TRUST_PROXY)) warnings.push("TRUST_PROXY is 0. On Render/Railway set it to 1, or rate limiting sees the proxy IP instead of the visitor.");
  }

  return { errors, warnings };
}

module.exports = { checkEnv, MIN_SECRET_LENGTH };
