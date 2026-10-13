// Password rules (Phase 20 - security). Pure function, easy to test.
//  - 8 to 128 characters (bcrypt only reads the first 72 bytes, and very long strings are a DoS risk)
//  - at least one letter and one number
//  - not a very common password
//  - not the same as the email name part
// Returns a list of problems. An empty list means the password is fine.

const MIN_LENGTH = 8;
const MAX_LENGTH = 128;

const COMMON = new Set([
  "password", "password1", "password12", "password123", "12345678", "123456789", "1234567890",
  "qwerty123", "qwertyuiop", "iloveyou1", "admin123", "admin12345", "letmein123", "welcome123",
  "abc12345", "abcd1234", "11111111", "00000000", "bismillah1", "muhammad123", "allah12345",
  "changeme12345", "siraj12345", "pakistan123",
]);

function passwordProblems(password, { email = "" } = {}) {
  const problems = [];
  const pw = typeof password === "string" ? password : "";

  if (pw.length < MIN_LENGTH) problems.push(`Password must be at least ${MIN_LENGTH} characters`);
  if (pw.length > MAX_LENGTH) problems.push(`Password must be at most ${MAX_LENGTH} characters`);
  if (!/\p{L}/u.test(pw)) problems.push("Password must contain at least one letter");
  if (!/\p{N}/u.test(pw)) problems.push("Password must contain at least one number");
  if (COMMON.has(pw.toLowerCase())) problems.push("This password is too common. Choose a less guessable one");

  const local = String(email).split("@")[0].toLowerCase();
  if (local.length >= 4 && pw.toLowerCase().includes(local)) problems.push("Password must not contain your email name");

  return problems;
}

module.exports = { passwordProblems, MIN_LENGTH, MAX_LENGTH };
