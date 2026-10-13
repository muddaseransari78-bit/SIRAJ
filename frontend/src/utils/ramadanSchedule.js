// Pure helpers for the Ramadan page (no React, no browser APIs) so they can be unit-tested.
import { dmyToISO, wallTimeToEpoch } from "./prayerSchedule.js";

/** Moment (ms since 1970) of "Imsak" / "Fajr" / "Maghrib" for the day a prayer-times answer describes. */
export function momentOf(data, name) {
  if (!data || !data.timings || !data.timings[name] || !data.gregorianDate) return null;
  return wallTimeToEpoch(dmyToISO(data.gregorianDate), data.timings[name], data.timezone);
}

/** Sehri ends at Imsak; when the API gave no Imsak, Fajr is used. */
function sehriMoment(data) {
  return momentOf(data, "Imsak") ?? momentOf(data, "Fajr");
}

/**
 * What the big countdown shows right now.
 *  before Imsak   -> "Sehri ends in"
 *  until Maghrib  -> "Iftar in"
 *  after Maghrib  -> tomorrow's Imsak (exact when tomorrow's times are known, otherwise today's + 24h, approximate)
 */
export function ramadanCountdown(nowMs, today, tomorrow) {
  const imsak = sehriMoment(today);
  const maghrib = momentOf(today, "Maghrib");
  if (imsak === null || maghrib === null) return null;
  if (nowMs < imsak) return { kind: "sehri", label: "Sehri ends in", at: imsak, approximate: false };
  if (nowMs < maghrib) return { kind: "iftar", label: "Iftar in", at: maghrib, approximate: false };
  const next = tomorrow ? sehriMoment(tomorrow) : null;
  if (next !== null) return { kind: "sehri", label: "Sehri ends in", at: next, approximate: false };
  return { kind: "sehri", label: "Sehri ends in (approx.)", at: imsak + 24 * 3600 * 1000, approximate: true };
}

/** 3725000 ms -> "01:02:05" (never negative). */
export function formatCountdown(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

export const DEFAULT_RAMADAN_REMINDERS = { enabled: false, sehriBefore: 30, iftarBefore: 10, iftarAt: true };

/** Fill missing / bad fields of saved reminder settings. */
export function sanitizeReminders(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  const minutes = (v, fallback) => (Number.isInteger(v) && v >= 0 && v <= 120 ? v : fallback);
  return {
    enabled: r.enabled === true,
    sehriBefore: minutes(r.sehriBefore, DEFAULT_RAMADAN_REMINDERS.sehriBefore),
    iftarBefore: minutes(r.iftarBefore, DEFAULT_RAMADAN_REMINDERS.iftarBefore),
    iftarAt: r.iftarAt !== false,
  };
}

/**
 * Reminder events for the given days (today + tomorrow), in the same shape the prayer reminders use
 * (key, fireAt, title, body, adhan) so usePrayerNotifications can fire them.
 * Only days that are in Ramadan (Hijri month 9) get reminders.
 */
export function buildRamadanEvents(days, rawReminders) {
  const reminders = sanitizeReminders(rawReminders);
  if (!reminders.enabled) return [];
  const events = [];
  (days || []).forEach((data) => {
    if (!data || !data.hijri || data.hijri.monthNumber !== 9) return;
    const iso = dmyToISO(data.gregorianDate);
    const imsak = sehriMoment(data);
    const maghrib = momentOf(data, "Maghrib");
    const clock = (name) => String((data.timings && (data.timings[name] || data.timings.Fajr)) || "").split(" ")[0];

    if (imsak !== null && reminders.sehriBefore > 0) {
      const n = reminders.sehriBefore;
      events.push({
        key: `${iso}:sehri:before`, fireAt: imsak - n * 60000, adhan: false, url: "/ramadan",
        title: "SIRAJ • Sehri",
        body: `Sehri ends in ${n} minute${n === 1 ? "" : "s"}. (Imsak ${clock("Imsak")})`,
      });
    }
    if (maghrib !== null && reminders.iftarBefore > 0) {
      const n = reminders.iftarBefore;
      events.push({
        key: `${iso}:iftar:before`, fireAt: maghrib - n * 60000, adhan: false, url: "/ramadan",
        title: "SIRAJ • Iftar",
        body: `Iftar is in ${n} minute${n === 1 ? "" : "s"}. (Maghrib ${clock("Maghrib")})`,
      });
    }
    if (maghrib !== null && reminders.iftarAt) {
      events.push({
        key: `${iso}:iftar:at`, fireAt: maghrib, adhan: false, url: "/ramadan",
        title: "SIRAJ • Iftar",
        body: `It is time for Iftar. (Maghrib ${clock("Maghrib")})`,
      });
    }
  });
  return events.sort((a, b) => a.fireAt - b.fireAt);
}
