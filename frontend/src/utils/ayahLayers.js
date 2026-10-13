// Decides which texts of a found Ayah to show, so the result is in the language the reader chose.
// r = { text, arabicText?, urduText?, matches?: [{ kind }] }   (text = the text the search matched or the English translation)
// Returns [{ kind: "arabic" | "urdu" | "english", text, marked }]   marked = the searched words are inside this text.

const has = (v) => typeof v === "string" && v.trim().length > 0;

export function pickAyahLayers(r, lang) {
  if (!r) return [];
  const kinds = Array.isArray(r.matches) ? r.matches.map((m) => m.kind) : [];
  const hitArabic = kinds.includes("arabic");
  const hitUrdu = kinds.includes("urdu");
  const arabic = hitArabic ? r.text : r.arabicText;
  const urdu = hitUrdu ? r.text : r.urduText;
  const englishHit = !hitArabic && !hitUrdu;
  const english = englishHit && has(r.text) ? r.text : "";

  const out = [];
  if (lang === "ur") {
    if (has(arabic)) out.push({ kind: "arabic", text: arabic, marked: hitArabic });
    if (has(urdu)) out.push({ kind: "urdu", text: urdu, marked: hitUrdu });
  } else if (lang === "ar") {
    if (has(arabic)) out.push({ kind: "arabic", text: arabic, marked: hitArabic });
  } else if (hitArabic && has(arabic)) {
    out.push({ kind: "arabic", text: arabic, marked: true });
  } else if (hitUrdu && has(urdu)) {
    out.push({ kind: "urdu", text: urdu, marked: true });
  }
  // English reader, or the Arabic / Urdu text is not available (the source was slow): show the English text instead of nothing
  if (out.length === 0 && has(r.text)) out.push({ kind: "english", text: english || r.text, marked: englishHit });
  return out;
}

/** Surah name for a result: Arabic name for Urdu / Arabic readers when the server sent it. */
export function resultSurahName(r, lang) {
  if (!r) return "";
  return lang !== "en" && has(r.surahArabicName) ? r.surahArabicName : r.surahName || "";
}
