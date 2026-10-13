// Turns the page's practice history into the body of POST /api/recitation/sessions.
// Only numbers are sent: never audio and never the words that were heard.

/**
 * history: [{ ayahNumber, score, problems }] in the order recited. If the same Ayah appears twice,
 * the LAST result wins. Returns null when there is nothing to save.
 */
export function buildSessionPayload(surahNumber, history, date) {
  const last = new Map();
  (history || []).forEach((h) => {
    if (Number.isInteger(h.ayahNumber)) last.set(h.ayahNumber, h);
  });
  if (last.size === 0) return null;
  const clamp = (v, max) => Math.max(0, Math.min(max, Math.round(Number(v) || 0)));
  const ayahs = [...last.values()].slice(0, 286).map((h) => ({
    ayahNumber: h.ayahNumber, score: clamp(h.score, 100), problems: clamp(h.problems, 400),
  }));
  return { surahNumber, ayahs, ...(date ? { date } : {}) };
}

/** "3 of 7 Ayahs below 60%" style helper: how many practised Ayahs need another try. */
export function ayahsToRepeat(ayahs = [], threshold = 70) {
  return ayahs.filter((a) => a.score < threshold).map((a) => a.ayahNumber);
}
