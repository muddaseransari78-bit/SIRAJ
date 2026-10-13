// Input sanitizing (Phase 20 - security).
//
// MongoDB "NoSQL injection": an attacker sends {"email": {"$gt": ""}} instead of a text email.
// Mongo then treats $gt as an operator and the filter matches everybody.
// We remove every key that starts with "$" or contains "." from request data,
// and also the prototype-pollution keys (__proto__, constructor, prototype).
// Nothing here changes normal text, numbers, booleans or arrays.

const BLOCKED_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const MAX_DEPTH = 10; // deeper than this is never real data - cut it off

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isUnsafeKey(key) {
  return key.startsWith("$") || key.includes(".") || BLOCKED_KEYS.has(key);
}

// Returns a cleaned COPY (the original is not changed).
function sanitizeValue(value, depth = 0) {
  if (depth > MAX_DEPTH) return undefined;
  if (Array.isArray(value)) return value.map((item) => sanitizeValue(item, depth + 1));
  if (!isPlainObject(value)) return value;

  const clean = {};
  for (const key of Object.keys(value)) {
    if (isUnsafeKey(key)) continue;
    clean[key] = sanitizeValue(value[key], depth + 1);
  }
  return clean;
}

module.exports = { sanitizeValue, isUnsafeKey };
