// Phase 30 - feedback form rules in the browser (the server checks everything again).
export const FEEDBACK_TYPES = ["general", "suggestion", "bug", "content"];
export const RECOMMEND_OPTIONS = ["yes", "maybe", "no"];
// id -> text key. Must match the list on the server (backend/utils/feedbackValidate.js).
export const FEATURE_OPTIONS = [
  ["quran", "nav.quran"], ["audio", "feedback.f.audio"], ["mushaf", "feedback.f.mushaf"], ["hadith", "nav.hadith"],
  ["tafseer", "nav.tafseer"], ["prayer", "nav.prayer"], ["qibla", "nav.qibla"], ["tasbeeh", "nav.tasbeeh"],
  ["duas", "nav.duas"], ["ramadan", "nav.ramadan"], ["calendar", "nav.calendar"], ["topics", "nav.topics"],
  ["sourceFinder", "nav.sourceFinder"], ["recitation", "nav.recite"], ["search", "feedback.f.search"],
];
export const MAX_TEXT = 1000;
export const MIN_PROBLEM_TEXT = 10;

export const emptyForm = () => ({
  type: "general",
  ratings: { overall: 0, ease: 0, quran: 0, audio: 0 },
  features: [],
  recommend: "",
  improve: "",
  newFeature: "",
});

/** Returns null when the form can be sent, otherwise the text key of the problem. */
export function validateForm(form) {
  if (!(form.ratings.overall >= 1 && form.ratings.overall <= 5)) return "feedback.err.overall";
  if (!RECOMMEND_OPTIONS.includes(form.recommend)) return "feedback.err.recommend";
  if ((form.type === "bug" || form.type === "content") && form.improve.trim().length < MIN_PROBLEM_TEXT) return "feedback.err.describe";
  if (form.improve.length > MAX_TEXT || form.newFeature.length > MAX_TEXT) return "feedback.err.tooLong";
  return null;
}

/** The body sent to POST /api/feedback (ratings left at 0 are not sent). */
export function buildPayload(form) {
  const ratings = { overall: form.ratings.overall };
  for (const key of ["ease", "quran", "audio"]) if (form.ratings[key] >= 1) ratings[key] = form.ratings[key];
  return {
    type: form.type,
    ratings,
    features: form.features,
    recommend: form.recommend,
    improve: form.improve.trim(),
    newFeature: form.newFeature.trim(),
  };
}

/** Adds or removes one id from a list (returns a new list). */
export function toggleItem(list, id) {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

/** Only in-app paths are allowed as the "go back here after login" target. */
export function safeReturnPath(value, fallback = "/dashboard") {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") ? value : fallback;
}
