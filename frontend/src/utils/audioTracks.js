// Phase 30 - helpers for the Quran audio player (pure functions, easy to test).
// One player now works for a whole Surah AND for Juz / Page / Hizb / Ruku, which can contain Ayahs of several Surahs.

export const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

/** Surah numbers of a list of Ayahs, in reading order, without repeats. */
export function uniqueSurahs(ayahs) {
  const out = [];
  for (const a of ayahs || []) {
    if (a && Number.isInteger(a.surahNumber) && !out.includes(a.surahNumber)) out.push(a.surahNumber);
  }
  return out;
}

/** Splits a list into groups of at most `size` (used to ask the server for a few Surahs at a time). */
export function chunk(list, size) {
  const n = Math.max(1, Math.floor(size) || 1);
  const out = [];
  for (let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n));
  return out;
}

/** Tracks of one Surah: audio = [{ numberInSurah, audio }] from the server. */
export function buildSurahTracks(surahNumber, audio) {
  return (audio || [])
    .filter((a) => a && a.audio)
    .map((a) => ({ surahNumber, numberInSurah: a.numberInSurah, audio: httpsUrl(a.audio) }));
}

/**
 * Tracks of a Juz / Page / ...: follows the order of `ayahs` and uses the audio of each Ayah's Surah.
 * audioBySurah = { [surahNumber]: [{ numberInSurah, audio }] }. Ayahs without audio are skipped.
 */
export function buildRangeTracks(ayahs, audioBySurah) {
  const lookup = {};
  for (const [surah, list] of Object.entries(audioBySurah || {})) {
    const map = new Map();
    for (const a of list || []) if (a && a.audio) map.set(a.numberInSurah, httpsUrl(a.audio));
    lookup[surah] = map;
  }
  const tracks = [];
  for (const ayah of ayahs || []) {
    const url = lookup[ayah.surahNumber]?.get(ayah.numberInSurah);
    if (url) tracks.push({ surahNumber: ayah.surahNumber, numberInSurah: ayah.numberInSurah, audio: url });
  }
  return tracks;
}

/** Index of the track for Surah:Ayah, or -1. */
export function findTrackIndex(tracks, surahNumber, numberInSurah) {
  return (tracks || []).findIndex((t) => t.surahNumber === surahNumber && t.numberInSurah === numberInSurah);
}

export const ayahKey = (surahNumber, numberInSurah) => `${surahNumber}:${numberInSurah}`;

/** 75 -> "1:15". Anything that is not a finite positive number -> "0:00". */
export function formatTime(seconds) {
  const s = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Next repeat mode in the cycle off -> ayah -> all -> off. */
export function nextRepeat(mode) {
  return mode === "off" ? "ayah" : mode === "ayah" ? "all" : "off";
}

/**
 * What happens when an Ayah ends.
 * Returns "replay" (same Ayah again), "next" (go to index + 1), "restart" (back to the first Ayah) or "stop".
 */
export function afterEnded(repeat, index, total) {
  if (repeat === "ayah") return "replay";
  if (index + 1 < total) return "next";
  if (repeat === "all" && total > 0) return "restart";
  return "stop";
}

/** An http:// audio link is upgraded to https:// (the site is served over https; mixed content would be blocked). */
export function httpsUrl(url) {
  return typeof url === "string" ? url.trim().replace(/^http:\/\//i, "https://") : "";
}

/** Links of the next `count` tracks after `index` (they are downloaded in advance so the next Ayah starts without a gap). */
export function preloadTargets(tracks, index, count = 2) {
  const out = [];
  for (let k = 1; k <= count; k += 1) {
    const url = tracks?.[index + k]?.audio;
    if (url) out.push(url);
  }
  return out;
}
