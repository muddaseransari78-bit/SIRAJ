import api from "./api";
import { offlinePrayerData } from "../utils/solarTimes";
import { PRAYERS } from "../utils/prayerSchedule";

// Prayer times for the Prayer / Home pages. The online service (via our server) is used first.
// If it cannot be reached and we know the exact position (latitude + longitude), the times are calculated on the
// device instead, so the page never stays empty. `data.source === "device"` marks those (the page shows a note).
// params: { lat, lng } or { city, country }, plus method, school, tune, date ("DD-MM-YYYY").
export async function loadPrayerTimes(params, adjust = {}) {
  try {
    const { data } = await api.get("/prayer/times", { params });
    return data.data;
  } catch (err) {
    const status = err && err.response && err.response.status;
    const hasCoords = Number.isFinite(params.lat) && Number.isFinite(params.lng);
    // a wrong city name (404) or bad input (400) is the person's to fix: not a reason to guess
    if (!hasCoords || status === 400 || status === 404) throw err;
    const [d, m, y] = String(params.date || "").split("-").map(Number);
    const when = d && m && y ? new Date(y, m - 1, d, 12) : new Date();
    const data = offlinePrayerData({ latitude: params.lat, longitude: params.lng }, when, { method: params.method, school: params.school, adjust });
    if (PRAYERS.some((p) => !data.timings[p])) throw err; // polar regions: no honest answer on the device either
    return data;
  }
}
