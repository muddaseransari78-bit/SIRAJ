/**
 * Prints two different strong JWT secrets (and nothing else) so you can paste them into .env
 * or into Render -> Environment. Usage (in the backend folder):   npm run secrets
 * Nothing is saved to disk; run it again for new values.
 */
const crypto = require("node:crypto");

function makeSecret(bytes = 48) {
  return crypto.randomBytes(bytes).toString("hex"); // 96 characters
}

function makeSecretPair() {
  const access = makeSecret();
  let refresh = makeSecret();
  while (refresh === access) refresh = makeSecret(); // practically never, but the rule is "must differ"
  return { JWT_ACCESS_SECRET: access, JWT_REFRESH_SECRET: refresh };
}

if (require.main === module) {
  const pair = makeSecretPair();
  console.log("Copy these two lines into backend/.env (or your host's environment settings):\n");
  for (const [k, v] of Object.entries(pair)) console.log(`${k}=${v}`);
  console.log("\nKeep them private. Never put them in chat, git or the frontend.");
}

module.exports = { makeSecret, makeSecretPair };
