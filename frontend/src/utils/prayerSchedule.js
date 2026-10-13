// Pure helpers for prayer times, Jamaat and reminders (no React, no browser APIs) so they can be unit-tested.
// Same logic as backend/utils/prayerSchedule.js (the server uses it for push notifications) - keep the two in step; both have tests.
// Phase 31: adds Jamaat (congregation) times - Jamaat is NOT the same as the start of the prayer time.

export const PRAYERS = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];

export const DEFAULT_PRAYER_SETTINGS = {
  method: 1,
  school: 1, // 0 = Shafi/Maliki/Hanbali, 1 = Hanafi (Ahl-e-Sunnat of Pakistan / India follow Hanafi)
  notificationsEnabled: false,
  adhanEnabled: false,
  minutesBefore: 0,
  perPrayer: {},
  adhanPer: {},
  before: {},
  adjust: {},
  customMessage: {},
  city: "",
  country: "",
  // Jamaat: "off" = not used, "fixed" = a clock time (e.g. 13:30), "offset" = N minutes after the prayer starts
  jamaatEnabled: true,
  jamaatBefore: 10, // reminder N minutes before Jamaat (0 = none)
  jamaatMode: { Fajr: "off", Dhuhr: "fixed", Asr: "fixed", Maghrib: "off", Isha: "off" },
  jamaatTime: { Fajr: "", Dhuhr: "13:30", Asr: "16:30", Maghrib: "", Isha: "" },
  jamaatOffset: { Fajr: 20, Dhuhr: 15, Asr: 15, Maghrib: 5, Isha: 15 },
};

const NESTED = ["perPrayer", "adhanPer", "before", "adjust", "customMessage", "jamaatMode", "jamaatTime", "jamaatOffset"];

export function mergeSettings(settings, patch) {
  const next = { ...settings, ...patch };
  NESTED.forEach((key) => {
    if (patch[key]) next[key] = { ...(settings[key] || {}), ...patch[key] };
  });
  return next;
}

/** Fill any missing field (old saved settings, .lean() documents) with defaults. */
export function withDefaults(settings) {
  return mergeSettings(DEFAULT_PRAYER_SETTINGS, settings || {});
}

/** "tune" string for AlAdhan: manual minute corrections. "" when everything is 0. */
export function tuneFromSettings(settings) {
  const a = (settings && settings.adjust) || {};
  const n = (k) => (Number.isInteger(a[k]) ? a[k] : 0);
  const list = [n("Fajr"), n("Fajr"), 0, n("Dhuhr"), n("Asr"), n("Maghrib"), 0, n("Isha"), 0];
  return list.every((x) => x === 0) ? "" : list.join(",");
}

// ---------- time zones ----------

export function isValidTimeZone(tz) {
  if (typeof tz !== "string" || !tz || tz.length > 64) return false;
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch (e) { return false; }
}

export function zoneOffsetMs(epochMs, timeZone) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const p = {};
  f.formatToParts(new Date(epochMs)).forEach((x) => { p[x.type] = x.value; });
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUtc - Math.floor(epochMs / 1000) * 1000;
}

/** "2026-10-02" + "05:10" in zone "Asia/Karachi" -> moment in time (ms since 1970). */
export function wallTimeToEpoch(dateISO, hhmm, timeZone) {
  const [y, mo, d] = dateISO.split("-").map(Number);
  const [h, mi] = String(hhmm).split(" ")[0].split(":").map(Number);
  if (!timeZone) return new Date(y, mo - 1, d, h, mi, 0, 0).getTime();
  const guess = Date.UTC(y, mo - 1, d, h, mi, 0, 0);
  const off1 = zoneOffsetMs(guess, timeZone);
  let t = guess - off1;
  const off2 = zoneOffsetMs(t, timeZone);
  if (off2 !== off1) t = guess - off2; // daylight-saving edge
  return t;
}

/** The calendar date ("YYYY-MM-DD") and clock ({hour, minute}) in a time zone at a moment. */
export function localParts(epochMs, timeZone) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
  const p = {};
  f.formatToParts(new Date(epochMs)).forEach((x) => { p[x.type] = x.value; });
  return { dateISO: `${p.year}-${p.month}-${p.day}`, hour: +p.hour, minute: +p.minute };
}

export function isoToDMY(iso) {
  const [y, m, d] = String(iso).split("-");
  return `${d}-${m}-${y}`;
}
export function dmyToISO(dmy) {
  const [d, m, y] = String(dmy).split("-");
  return `${y}-${m}-${d}`;
}
export function addDaysISO(iso, n) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

// ---------- 12-hour text ----------

/** "13:30" -> "1:30 PM" (also accepts "13:30 (PKT)"). */
export function fmt12(hhmm) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm).trim());
  if (!m) return String(hhmm);
  const h = Number(m[1]);
  return `${h % 12 === 0 ? 12 : h % 12}:${m[2]} ${h >= 12 ? "PM" : "AM"}`;
}

/** Epoch -> "1:30 PM" in a time zone. */
export function fmt12At(epochMs, timeZone) {
  const p = localParts(epochMs, timeZone || "UTC");
  return fmt12(`${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`);
}

// ---------- Jamaat ----------

export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Jamaat moment of ONE prayer.
 * Returns null when Jamaat is off / not set, otherwise { at, clamped }.
 * "clamped" = the fixed time was EARLIER than the prayer's start (for example a fixed Asr Jamaat of 4:30 PM in
 * summer, when Hanafi Asr only starts at 5:15 PM). Jamaat can never be before the prayer starts, so the start is used.
 */
export function jamaatMoment({ prayerAt, dateISO, timeZone, settings, name }) {
  if (!settings.jamaatEnabled) return null;
  const mode = (settings.jamaatMode || {})[name];
  if (mode === "fixed") {
    const time = (settings.jamaatTime || {})[name];
    if (!TIME_RE.test(String(time || ""))) return null;
    const at = wallTimeToEpoch(dateISO, time, timeZone);
    return at < prayerAt ? { at: prayerAt, clamped: true } : { at, clamped: false };
  }
  if (mode === "offset") {
    const off = (settings.jamaatOffset || {})[name];
    if (!Number.isInteger(off) || off < 0 || off > 180) return null;
    return { at: prayerAt + off * 60000, clamped: false };
  }
  return null;
}

/** Epoch (ms) of each of the 5 prayers for the day the data describes. */
export function prayerMoments(data) {
  const iso = dmyToISO(data.gregorianDate);
  const out = {};
  PRAYERS.forEach((p) => {
    if (data.timings && data.timings[p]) out[p] = wallTimeToEpoch(iso, data.timings[p], data.timezone);
  });
  return out;
}

/** Jamaat moments for the day: { Dhuhr: { at, clamped }, ... } (only prayers that have Jamaat). */
export function jamaatMoments(data, rawSettings) {
  const settings = withDefaults(rawSettings);
  const iso = dmyToISO(data.gregorianDate);
  const moments = prayerMoments(data);
  const out = {};
  PRAYERS.forEach((name) => {
    if (!moments[name]) return;
    const j = jamaatMoment({ prayerAt: moments[name], dateISO: iso, timeZone: data.timezone, settings, name });
    if (j) out[name] = j;
  });
  return out;
}

/**
 * All reminder events of the day. A prayer can give up to FOUR events:
 *   before   "X prayer is in N minutes."
 *   at       "It is time for X Salah."
 *   jbefore  "X Jamaat is in N minutes (1:30 PM)."
 *   jat      "X Jamaat is now. (1:30 PM)"
 */
export function buildSchedule(data, rawSettings) {
  if (!data || !data.timings || !data.gregorianDate) return [];
  const settings = withDefaults(rawSettings);
  if (!settings.notificationsEnabled) return [];
  const iso = dmyToISO(data.gregorianDate);
  const events = [];

  PRAYERS.forEach((name) => {
    if (settings.perPrayer[name] === false) return;
    if (!data.timings[name]) return;
    const prayerAt = wallTimeToEpoch(iso, data.timings[name], data.timezone);
    const own = settings.before[name];
    const before = Number.isInteger(own) ? own : settings.minutesBefore;
    const clock = fmt12(data.timings[name]);

    if (before > 0) {
      events.push({
        key: `${iso}:${name}:before`,
        name, type: "before", fireAt: prayerAt - before * 60000, prayerAt,
        title: `SIRAJ • ${name}`,
        body: `${name} prayer is in ${before} minute${before === 1 ? "" : "s"}. (${clock})`,
        adhan: false,
      });
    }
    const custom = (settings.customMessage[name] || "").trim();
    events.push({
      key: `${iso}:${name}:at`,
      name, type: "at", fireAt: prayerAt, prayerAt,
      title: `SIRAJ • ${name}`,
      body: custom || `It is time for ${name} Salah. (${clock})`,
      adhan: settings.adhanEnabled && settings.adhanPer[name] !== false,
    });

    const j = jamaatMoment({ prayerAt, dateISO: iso, timeZone: data.timezone, settings, name });
    if (j) {
      const jClock = fmt12At(j.at, data.timezone);
      const jb = settings.jamaatBefore;
      // A Jamaat at the very start is already announced by the "at" event above.
      if (jb > 0 && j.at - jb * 60000 > prayerAt) {
        events.push({
          key: `${iso}:${name}:jbefore`,
          name, type: "jbefore", fireAt: j.at - jb * 60000, prayerAt, jamaatAt: j.at,
          title: `SIRAJ • ${name} Jamaat`,
          body: `${name} Jamaat is in ${jb} minute${jb === 1 ? "" : "s"}. (${jClock})`,
          adhan: false,
        });
      }
      if (j.at > prayerAt) {
        events.push({
          key: `${iso}:${name}:jat`,
          name, type: "jat", fireAt: j.at, prayerAt, jamaatAt: j.at,
          title: `SIRAJ • ${name} Jamaat`,
          body: `${name} Jamaat is now. (${jClock})`,
          adhan: false,
        });
      }
    }
  });

  return events.sort((a, b) => a.fireAt - b.fireAt);
}

/** Events that should fire right now: due, and not older than `graceMs`, and not fired before. */
export function dueEvents(events, nowMs, firedKeys, graceMs = 2 * 60 * 1000) {
  return events.filter((e) => e.fireAt <= nowMs && nowMs - e.fireAt <= graceMs && !firedKeys.has(e.key));
}

/** Next prayer after `nowMs`. After Isha it is tomorrow's Fajr, estimated as today's Fajr + 24h. */
export function nextPrayer(data, nowMs) {
  const moments = prayerMoments(data);
  for (const name of PRAYERS) {
    if (moments[name] && moments[name] > nowMs) return { name, at: moments[name], approximate: false };
  }
  if (moments.Fajr) return { name: "Fajr", at: moments.Fajr + 24 * 3600 * 1000, approximate: true };
  return null;
}

/**
 * What is happening right now for Jamaat?
 *  - "waiting": a prayer has started and its Jamaat is still to come  -> { name, startAt, jamaatAt }
 *  - null: nothing to wait for (no Jamaat set, or Jamaat already over)
 * Also gives the NEXT Jamaat of the day (next.name / next.at) for the "Next Jamaat" line.
 */
export function jamaatStatus(data, rawSettings, nowMs) {
  const moments = prayerMoments(data);
  const jm = jamaatMoments(data, rawSettings);
  let waiting = null;
  let next = null;
  PRAYERS.forEach((name) => {
    const j = jm[name];
    if (!j || !moments[name]) return;
    if (moments[name] <= nowMs && nowMs < j.at && !waiting) waiting = { name, startAt: moments[name], jamaatAt: j.at };
    if (j.at > nowMs && !next) next = { name, at: j.at, clamped: j.clamped };
  });
  return { waiting, next };
}
