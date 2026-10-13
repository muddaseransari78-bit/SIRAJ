// Phase 31 - ONE place that remembers how prayer times are calculated on this device, so the Home page,
// the Prayer page and the Ramadan page all show the SAME times (before, Home used the server's own default).
import { tuneFromSettings } from "./prayerSchedule.js";

export const CALC_KEY = "siraj_calc";
export const DEFAULT_CALC = { method: 1, school: 1, tune: "" }; // Karachi method + Hanafi Asr

function store(storage) {
  if (storage) return storage;
  return typeof localStorage === "undefined" ? null : localStorage;
}

/** Remember { method, school, tune } from the prayer settings. */
export function saveCalc(settings, storage) {
  const s = store(storage);
  if (!s || !settings) return;
  try {
    s.setItem(CALC_KEY, JSON.stringify({ method: settings.method, school: settings.school, tune: tuneFromSettings(settings) }));
  } catch (e) { /* ignore */ }
}

/** The remembered calculation, with safe defaults. */
export function readCalc(storage) {
  const s = store(storage);
  let saved = null;
  try { saved = s ? JSON.parse(s.getItem(CALC_KEY) || "null") : null; } catch (e) { saved = null; }
  const method = Number.isInteger(saved && saved.method) && saved.method >= 0 && saved.method <= 99 ? saved.method : DEFAULT_CALC.method;
  const school = saved && (saved.school === 0 || saved.school === 1) ? saved.school : DEFAULT_CALC.school;
  const tune = saved && typeof saved.tune === "string" && /^(-?\d{1,2},){8}-?\d{1,2}$/.test(saved.tune) ? saved.tune : "";
  return { method, school, tune };
}

/** The query params for GET /prayer/times (tune only when set). */
export function calcParams(storage) {
  const c = readCalc(storage);
  return { method: c.method, school: c.school, ...(c.tune ? { tune: c.tune } : {}) };
}
