import api from "./api";

export async function fetchSurahs() {
  const { data } = await api.get("/quran/surahs");
  return data.data.surahs;
}

export async function fetchSurahDetail(surahNumber, translation) {
  const { data } = await api.get(`/quran/surah/${surahNumber}`, {
    params: translation ? { translation } : {},
  });
  return data.data.surah;
}

export async function searchQuran(query) {
  const { data } = await api.get("/quran/search", { params: { q: query } });
  return data.data.results;
}

export async function fetchReciters() {
  const { data } = await api.get("/quran/reciters");
  return data.data.reciters;
}

export async function fetchSurahAudio(surahNumber, reciter) {
  const { data } = await api.get(`/quran/surah/${surahNumber}/audio`, {
    params: reciter ? { reciter } : {},
  });
  return data.data.audio;
}

// Browse by "juz" | "page" | "hizb" | "ruku"
export async function fetchRange(type, number) {
  const { data } = await api.get(`/quran/range/${type}/${number}`);
  return data.data.range;
}

// Tajweed-marked text of a Surah: { surahNumber, source, ayahs: [{ numberInSurah, text }] }
export async function fetchTajweed(surahNumber) {
  const { data } = await api.get(`/quran/surah/${surahNumber}/tajweed`);
  return data.data.tajweed;
}

// ---- Topics ----
export async function fetchTopics() {
  const { data } = await api.get("/quran/topics");
  return data.data.topics;
}
export async function fetchTopic(slug, lang) {
  const { data } = await api.get(`/quran/topics/${encodeURIComponent(slug)}`, { params: lang && lang !== "en" ? { lang } : {} });
  return data.data;
}
