// Small pure helpers for the My SIRAJ dashboard (no React, easy to test).

const METHOD_LABELS = {
  1: "Karachi (Univ. of Islamic Sciences)",
  2: "ISNA (North America)",
  3: "Muslim World League",
  4: "Umm al-Qura (Makkah)",
  5: "Egyptian General Authority",
  8: "Gulf Region",
  11: "Singapore",
  13: "Diyanet (Turkey)",
  15: "Moonsighting Committee",
};

export const methodLabel = (id) => METHOD_LABELS[id] || `Method ${id}`;
export const madhabLabel = (school) => (school === 1 ? "Hanafi" : "Shafi / Maliki / Hanbali");

/** Whole-number percent, safe when the total is 0. Never above 100. */
export function percentOf(done, total) {
  if (!total || total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((done / total) * 100)));
}

/** Colour strength (0-4) of one heatmap square from how many reading actions happened that day. */
export function heatLevel(count) {
  if (!count || count < 1) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  return 4;
}

/** { label, to } for a saved item (Ayah, Surah, Hadith or Dua). */
export function bookmarkTarget(b) {
  if (b.type === "AYAH") return { label: `Quran ${b.surahNumber}:${b.ayahNumber}`, to: `/quran/${b.surahNumber}?ayah=${b.ayahNumber}` };
  if (b.type === "SURAH") return { label: `Surah ${b.surahNumber}`, to: `/quran/${b.surahNumber}` };
  if (b.type === "HADITH") return { label: `${b.hadithBook} #${b.hadithNumber}`, to: `/hadith/${b.hadithBook}` };
  return { label: `Dua ${b.duaRef}`, to: "/duas" };
}

/** Splits saved items into the three groups shown in the "Saved" tab. */
export function groupBookmarks(list = []) {
  const groups = { quran: [], hadith: [], duas: [] };
  list.forEach((b) => {
    if (b.type === "HADITH") groups.hadith.push(b);
    else if (b.type === "DUA") groups.duas.push(b);
    else groups.quran.push(b);
  });
  return groups;
}

/** Sum and best day of a [{ count }] list - used for the small bar charts. */
export function weekTotals(days = []) {
  const counts = days.map((d) => d.count);
  return { total: counts.reduce((a, b) => a + b, 0), max: counts.length ? Math.max(...counts) : 0 };
}

/** Weeks (columns) of 7 days for the heatmap. The first column is padded so rows are Sun..Sat. */
export function heatmapColumns(days = []) {
  if (days.length === 0) return [];
  const firstWeekday = new Date(`${days[0].date}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  const cells = [...Array(firstWeekday).fill(null), ...days];
  const columns = [];
  for (let i = 0; i < cells.length; i += 7) columns.push(cells.slice(i, i + 7));
  return columns;
}
