// Turns a failed API call into a message a person can act on.
// The backend answers validation problems as { message: "Validation failed", errors: [{ field, message }] }.
// "Validation failed" alone helps nobody, so we show the specific reasons (for example the password rules).
export function apiErrorMessage(err, fallback) {
  const data = err && err.response && err.response.data;
  if (data && Array.isArray(data.errors) && data.errors.length) {
    const reasons = [...new Set(data.errors.map((e) => e && e.message).filter(Boolean))];
    if (reasons.length) return reasons.join(". ");
  }
  return (data && data.message) || fallback;
}
