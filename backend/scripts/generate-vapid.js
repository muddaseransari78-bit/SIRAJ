// Phase 31 - makes the VAPID key pair for background (push) prayer reminders. Uses only Node's own crypto.
//   cd backend
//   npm run vapid
// Paste the three lines into backend/.env (or into the Render "Environment" page). Make this pair ONCE and keep it:
// a new pair means every device has to turn background reminders on again.
const crypto = require("crypto");

const b64url = (buf) => buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** Returns { publicKey, privateKey } in the URL-safe base64 form browsers and the web-push package expect. */
function makeVapidKeys() {
  const ecdh = crypto.createECDH("prime256v1");
  ecdh.generateKeys();
  return {
    publicKey: b64url(ecdh.getPublicKey(null, "uncompressed")), // 65 bytes
    privateKey: b64url(ecdh.getPrivateKey()), // 32 bytes
  };
}

if (require.main === module) {
  const { publicKey, privateKey } = makeVapidKeys();
  console.log("# Paste these lines into backend/.env (keep the private key secret, never commit it)");
  console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
  console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
  console.log("VAPID_SUBJECT=mailto:you@example.com");
  console.log("# (replace you@example.com with your own e-mail address)");
  console.log("# Optional but recommended on a free host (see DEPLOYMENT.md section 8):");
  console.log(`CRON_SECRET=${b64url(crypto.randomBytes(24))}`);
}

module.exports = { makeVapidKeys, b64url };
