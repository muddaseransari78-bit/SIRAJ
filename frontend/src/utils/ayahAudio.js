// "Listen to this Ayah" helpers (pure functions, tested with plain Node).
//
// The server answers GET /quran/surah/:n/audio with an OBJECT: { surahNumber, reciter, reciterName, ayahs: [{ numberInSurah, audio }] }.
// (quranService.fetchSurahAudio returns that object as it is.) Older code treated it as a plain array, which made
// the button fail with "could not be loaded" every time. These helpers accept both shapes.

/** The list of { numberInSurah, audio } inside a server answer (object with `ayahs`, or already a list). */
export function audioList(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.ayahs)) return data.ayahs;
  return [];
}

/** https link of the recitation of one Ayah, or "" when there is none. An http link is upgraded to https (the site is served over https). */
export function audioUrlForAyah(data, numberInSurah) {
  const item = audioList(data).find((a) => a && Number(a.numberInSurah) === Number(numberInSurah));
  const url = item && typeof item.audio === "string" ? item.audio.trim() : "";
  if (!url) return "";
  return url.replace(/^http:\/\//i, "https://");
}
