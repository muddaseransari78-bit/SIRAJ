// Pure helper for the little password meter on the Register page. No React, so it is easy to test.
// 0 = empty, 1 weak, 2 fair (meets the site rule), 3 good, 4 strong
export function passwordStrength(pw = "") {
  if (!pw) return 0;
  const hasLetter = /[A-Za-z]/.test(pw);
  const hasNumber = /\d/.test(pw);
  const mixed = /[a-z]/.test(pw) && /[A-Z]/.test(pw);
  const symbol = /[^A-Za-z0-9]/.test(pw);
  if (pw.length < 8 || !hasLetter || !hasNumber) return 1;
  let score = 2;
  if (pw.length >= 10 && (mixed || symbol)) score = 3;
  if (pw.length >= 12 && mixed && symbol) score = 4;
  return score;
}
