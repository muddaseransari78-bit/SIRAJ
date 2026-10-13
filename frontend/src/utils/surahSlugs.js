// SEO-friendly Surah addresses: /quran/al-fatiha instead of /quran/1.
// Old numeric links (/quran/1) keep working and are redirected to the slug.
export const SURAH_SLUGS = [
  "al-fatiha", "al-baqarah", "ali-imran", "an-nisa", "al-maidah", "al-anam", "al-araf", "al-anfal", "at-tawbah", "yunus",
  "hud", "yusuf", "ar-rad", "ibrahim", "al-hijr", "an-nahl", "al-isra", "al-kahf", "maryam", "ta-ha",
  "al-anbiya", "al-hajj", "al-muminun", "an-nur", "al-furqan", "ash-shuara", "an-naml", "al-qasas", "al-ankabut", "ar-rum",
  "luqman", "as-sajdah", "al-ahzab", "saba", "fatir", "ya-sin", "as-saffat", "sad", "az-zumar", "ghafir",
  "fussilat", "ash-shura", "az-zukhruf", "ad-dukhan", "al-jathiyah", "al-ahqaf", "muhammad", "al-fath", "al-hujurat", "qaf",
  "adh-dhariyat", "at-tur", "an-najm", "al-qamar", "ar-rahman", "al-waqiah", "al-hadid", "al-mujadila", "al-hashr", "al-mumtahanah",
  "as-saff", "al-jumuah", "al-munafiqun", "at-taghabun", "at-talaq", "at-tahrim", "al-mulk", "al-qalam", "al-haqqah", "al-maarij",
  "nuh", "al-jinn", "al-muzzammil", "al-muddaththir", "al-qiyamah", "al-insan", "al-mursalat", "an-naba", "an-naziat", "abasa",
  "at-takwir", "al-infitar", "al-mutaffifin", "al-inshiqaq", "al-buruj", "at-tariq", "al-ala", "al-ghashiyah", "al-fajr", "al-balad",
  "ash-shams", "al-layl", "ad-duha", "ash-sharh", "at-tin", "al-alaq", "al-qadr", "al-bayyinah", "az-zalzalah", "al-adiyat",
  "al-qariah", "at-takathur", "al-asr", "al-humazah", "al-fil", "quraysh", "al-maun", "al-kawthar", "al-kafirun", "an-nasr",
  "al-masad", "al-ikhlas", "al-falaq", "an-nas",
];

/** Surah number (1-114) -> slug, or the number as text if it is out of range. */
export function surahSlug(number) {
  const n = Number(number);
  return Number.isInteger(n) && n >= 1 && n <= 114 ? SURAH_SLUGS[n - 1] : String(number);
}

/** Address part of a link: "/quran/al-baqarah" (extra e.g. "?ayah=42"). */
export function surahPath(number, extra = "") {
  return `/quran/${surahSlug(number)}${extra}`;
}

/** "al-fatiha" OR "1" -> 1. Returns null when it is neither. */
export function resolveSurahParam(param) {
  if (param == null) return null;
  const text = String(param).trim().toLowerCase();
  if (/^\d+$/.test(text)) {
    const n = Number(text);
    return n >= 1 && n <= 114 ? n : null;
  }
  const i = SURAH_SLUGS.indexOf(text);
  return i === -1 ? null : i + 1;
}

/** "ash-shuara" -> "Ash Shuara" (for page titles). */
export function slugToTitle(slug) {
  return String(slug).split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}
