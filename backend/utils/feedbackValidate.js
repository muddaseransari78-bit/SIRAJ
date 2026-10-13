// Phase 30 - checks the feedback form on the server (the browser check is only for convenience).
// Pure functions (no database), so they are easy to test.

const TYPES = ["general", "suggestion", "bug", "content"];
const RECOMMEND = ["yes", "maybe", "no"];
const FEATURES = [
  "quran", "audio", "mushaf", "hadith", "tafseer", "prayer", "qibla", "tasbeeh",
  "duas", "ramadan", "calendar", "topics", "sourceFinder", "recitation", "search",
];
const RATING_KEYS = ["overall", "ease", "quran", "audio"]; // overall is required, the rest are optional
const MAX_TEXT = 1000;

// Removes control characters and squeezes spaces; keeps normal line breaks.
function cleanText(value) {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function validRating(n) {
  return Number.isInteger(n) && n >= 1 && n <= 5;
}

/**
 * body: { type, ratings: { overall, ease, quran, audio }, features: [], recommend, improve, newFeature }
 * Returns { value } when fine, or { error } with a message that is safe to show to the user.
 */
function validateFeedback(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "Feedback is required" };

  const type = body.type === undefined ? "general" : body.type;
  if (!TYPES.includes(type)) return { error: `type must be one of: ${TYPES.join(", ")}` };

  const r = body.ratings && typeof body.ratings === "object" && !Array.isArray(body.ratings) ? body.ratings : {};
  if (!validRating(r.overall)) return { error: "Please give an overall rating from 1 to 5" };
  const ratings = { overall: r.overall };
  for (const key of RATING_KEYS) {
    if (key === "overall") continue;
    if (r[key] === undefined || r[key] === null || r[key] === "") continue;
    if (!validRating(r[key])) return { error: `${key} rating must be from 1 to 5` };
    ratings[key] = r[key];
  }

  if (!RECOMMEND.includes(body.recommend)) return { error: "Please answer: would you recommend SIRAJ?" };

  let features = [];
  if (body.features !== undefined) {
    if (!Array.isArray(body.features)) return { error: "features must be a list" };
    features = [...new Set(body.features)];
    if (features.some((f) => !FEATURES.includes(f))) return { error: "features contains an unknown option" };
  }

  const improve = cleanText(body.improve);
  const newFeature = cleanText(body.newFeature);
  if (improve.length > MAX_TEXT || newFeature.length > MAX_TEXT) {
    return { error: `Text answers can be at most ${MAX_TEXT} characters` };
  }
  // A bug report or content issue without any words is of no use to anyone.
  if ((type === "bug" || type === "content") && improve.length < 10) {
    return { error: "Please describe the problem in at least 10 characters" };
  }

  return { value: { type, ratings, features, recommend: body.recommend, improve, newFeature } };
}

module.exports = { validateFeedback, cleanText, TYPES, RECOMMEND, FEATURES, RATING_KEYS, MAX_TEXT };
