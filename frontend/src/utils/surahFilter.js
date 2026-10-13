// Surah list search: finds a Surah however it is typed.
//   name in English (any common spelling: baqara / baqarah / al-baqarah), Arabic or Urdu script (with or without harakat),
//   the number ("2", "٢", "۲"), the English meaning ("the cow"), or a reference such as "2:255" (opens that Ayah).
// Pure functions, tested with plain Node.

const DIGITS = { "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9", "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9" };
const MARKS_RE = /[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;

export const asciiDigits = (s) => String(s || "").replace(/[٠-٩۰-۹]/g, (d) => DIGITS[d]);

/** Latin form: lower case, no accents, only letters / digits. "Al-Baqarah" -> "albaqarah". Doubled letters are merged ("naas" -> "nas"). */
export function latinKey(s) {
  return asciiDigits(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "").replace(/(.)\1+/g, "$1")
    .replace(/ah$/, "a");
}

/** Arabic / Urdu form: no harakat, one alef / yeh / kaf / heh, no spaces, no leading "سورة". */
export function arabicKey(s) {
  return asciiDigits(s).normalize("NFKC").replace(MARKS_RE, "")
    .replace(/[أإآٱ]/g, "ا").replace(/[ىیيئ]/g, "ي").replace(/[کك]/g, "ك").replace(/[ةہھ]/g, "ه")
    .replace(/[^\u0600-\u06FF0-9\s]/g, " ").replace(/\s+/g, " ").trim()
    .replace(/^سور[ةه]\s*/, "").replace(/\s/g, "");
}

const hasArabicScript = (s) => /[\u0600-\u06FF]/.test(s);
const stripLatinArticle = (k) => k.replace(/^(al|an|ash|as|ad|ar|at|az|adh|ath|aal)(?=[a-z]{3,})/, "");

/** "2:255" / "2.255" / "٢:٢٥٥" -> { surah: 2, ayah: 255 }, otherwise null */
export function parseAyahRef(query) {
  const m = asciiDigits(query).trim().match(/^(\d{1,3})\s*[:.]\s*(\d{1,3})$/);
  if (!m) return null;
  const surah = Number(m[1]); const ayah = Number(m[2]);
  return surah >= 1 && surah <= 114 && ayah >= 1 ? { surah, ayah } : null;
}

/** Surahs that match the text, best first. surahs = [{ number, name, englishName, englishNameTranslation }] */
export function filterSurahs(surahs, query) {
  const list = Array.isArray(surahs) ? surahs : [];
  const raw = String(query || "").trim();
  if (!raw) return list;

  const digits = asciiDigits(raw).replace(/\s/g, "");
  if (/^\d{1,3}$/.test(digits)) return list.filter((s) => String(s.number) === String(Number(digits)));

  if (hasArabicScript(raw)) {
    const q = arabicKey(raw);
    const qNoArticle = q.replace(/^ال/, "");
    if (!q) return list;
    return list
      .map((s) => {
        const k = arabicKey(s.name);
        const kNo = k.replace(/^ال/, "");
        let score = 0;
        if (k === q || kNo === qNoArticle) score = 100;
        else if (kNo.startsWith(qNoArticle) && qNoArticle.length >= 2) score = 80;
        else if (k.includes(q) && q.length >= 2) score = 60;
        return { s, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || a.s.number - b.s.number)
      .map((x) => x.s);
  }

  const q = latinKey(raw.replace(/^(surah|sura|surat|soorah|soorat)\s+/i, ""));
  const qNo = stripLatinArticle(q);
  if (!q) return list;
  return list
    .map((s) => {
      const keys = [latinKey(s.englishName), latinKey(s.englishNameTranslation)];
      let score = 0;
      keys.forEach((k, i) => {
        const kNo = stripLatinArticle(k);
        let sc = 0;
        if (k === q || kNo === qNo) sc = 100;
        else if (kNo.startsWith(qNo) && qNo.length >= 2) sc = 80;
        else if (k.includes(q) && q.length >= 2) sc = 60;
        else if (qNo.length >= 4 && kNo.replace(/[aeiou]/g, "") === qNo.replace(/[aeiou]/g, "")) sc = 55; // yaseen / yasin
        score = Math.max(score, i === 0 ? sc : Math.min(sc, 70));
      });
      return { s, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.s.number - b.s.number)
    .map((x) => x.s);
}
