// Plain-language names for the marks returned by the harakat check (Urdu-style names first).
export const MARK_NAMES = {
  fatha: "zabar (fatha)",
  damma: "pesh (damma)",
  kasra: "zer (kasra)",
  sukun: "sukoon (no vowel)",
  fathatan: "double zabar (tanween)",
  dammatan: "double pesh (tanween)",
  kasratan: "double zer (tanween)",
  shadda: "shadda (tashdeed)",
};

const name = (mark) => MARK_NAMES[mark] || mark || "no mark";

/** One sentence for one difference: { letter, kind, expected, heard } */
export function describeDiff(d) {
  if (d.kind === "shadda") return `on ${d.letter}: shadda (tashdeed) is missing`;
  return `on ${d.letter}: expected ${name(d.expected)}, heard ${name(d.heard)}`;
}

/** Short line for a whole Ayah result. */
export function summaryLine(result) {
  if (!result) return "";
  if (!result.available) {
    return result.reason === "no-harakat"
      ? "Could not check: the pronunciation model returned plain letters without zabar/zer/pesh."
      : "Could not check: nothing was heard in the recording.";
  }
  const s = result.summary;
  const missing = s.notHeard > 0 ? ` ${s.notHeard} word${s.notHeard === 1 ? " was" : "s were"} not heard.` : "";
  if (s.wrong === 0 && s.ok === 0) return `Nothing could be compared.${missing}`;
  if (s.wrong === 0) return `No zabar/zer/pesh difference found in ${s.ok} word${s.ok === 1 ? "" : "s"}.${missing}`;
  return `${s.wrong} word${s.wrong === 1 ? "" : "s"} with a different zabar/zer/pesh or shadda.${missing}`;
}

// ---- Translated versions (Phase 33). `t` is the translate function from useI18n().
// The English helpers above stay as they are (they have their own tests).
const nameT = (t, mark) => (MARK_NAMES[mark] ? t(`mark.${mark}`) : mark || t("mark.none"));

export function describeDiffT(t, d) {
  if (d.kind === "shadda") return t("hr.shaddaMissing", { letter: d.letter });
  return t("hr.expectedHeard", { letter: d.letter, expected: nameT(t, d.expected), heard: nameT(t, d.heard) });
}

export function summaryLineT(t, result) {
  if (!result) return "";
  if (!result.available) {
    return result.reason === "no-harakat" ? t("hr.noHarakat") : t("hr.nothingHeard");
  }
  const s = result.summary;
  const missing = s.notHeard > 0 ? ` ${t(s.notHeard === 1 ? "hr.notHeard1" : "hr.notHeardN", { n: s.notHeard })}` : "";
  if (s.wrong === 0 && s.ok === 0) return `${t("hr.noCompare")}${missing}`;
  if (s.wrong === 0) return `${t(s.ok === 1 ? "hr.noDiff1" : "hr.noDiffN", { n: s.ok })}${missing}`;
  return `${t(s.wrong === 1 ? "hr.wrong1" : "hr.wrongN", { n: s.wrong })}${missing}`;
}
