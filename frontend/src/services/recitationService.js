import api from "./api";

// Is the zabar/zer/pesh check switched on at the server?
export async function fetchHarakatStatus() {
  const { data } = await api.get("/recitation/harakat/status");
  return Boolean(data.data.enabled);
}

// Sends the recording of ONE Ayah. Returns { available, reason, words, extra, summary, heardText, ... }
export async function checkHarakat(blob, surahNumber, ayahNumber) {
  const { data } = await api.post("/recitation/harakat", blob, {
    params: { surah: surahNumber, ayah: ayahNumber },
    headers: { "Content-Type": blob.type || "audio/webm" },
    timeout: 90000,
  });
  return data.data.result;
}

// LIVE: the audio of the Ayah SO FAR. Words not reached yet come back as "pending"; the unfinished last word is not judged.
export async function checkHarakatLive(blob, surahNumber, ayahNumber) {
  const { data } = await api.post("/recitation/harakat/live", blob, {
    params: { surah: surahNumber, ayah: ayahNumber },
    headers: { "Content-Type": blob.type || "audio/webm" },
    timeout: 20000,
  });
  return data.data.result;
}

// ---- Saved practice sessions (scores only, login required) ----
export async function saveRecitationSession(payload) {
  const { data } = await api.post("/recitation/sessions", payload);
  return data.data.session;
}
export async function fetchRecitationSessions(today) {
  const { data } = await api.get("/recitation/sessions", { params: today ? { today } : {} });
  return data.data;
}
export async function deleteRecitationSession(id) {
  await api.delete(`/recitation/sessions/${id}`);
}
