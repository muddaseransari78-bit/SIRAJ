// Built-in prayer time calculation (Phase 38). It is the safety net for the Prayer page: when the online service
// (AlAdhan) cannot be reached, the page still shows times, calculated here on the device from the sun's position.
// Same method as PrayTimes.org. Needs only latitude + longitude, no network. Pure functions, no React.
//
// Results are close to the online ones but may differ by a minute or two: the page tells the person so.

// Fajr / Isha sun angles (degrees below the horizon) for the AlAdhan method numbers the Prayer page offers.
// { fajr, isha } or { fajr, ishaMinutes } (Isha = N minutes after Maghrib).
const METHODS = {
  1: { fajr: 18, isha: 18 },          // University of Islamic Sciences, Karachi
  2: { fajr: 15, isha: 15 },          // ISNA
  3: { fajr: 18, isha: 17 },          // Muslim World League
  4: { fajr: 18.5, ishaMinutes: 90 }, // Umm al-Qura, Makkah
  5: { fajr: 19.5, isha: 17.5 },      // Egyptian General Authority
  8: { fajr: 19.5, ishaMinutes: 90 }, // Gulf region
  11: { fajr: 20, isha: 18 },         // Singapore (MUIS)
  13: { fajr: 18, isha: 17 },         // Diyanet, Turkey
  15: { fajr: 18, isha: 18 },         // Moonsighting Committee
};
const FALLBACK_METHOD = 3;

const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
const sin = (d) => Math.sin(rad(d));
const cos = (d) => Math.cos(rad(d));
const tan = (d) => Math.tan(rad(d));
const arcsin = (x) => deg(Math.asin(x));
const arccos = (x) => deg(Math.acos(x));
const arctan2 = (y, x) => deg(Math.atan2(y, x));
const arccot = (x) => deg(Math.atan(1 / x));
const fixAngle = (a) => ((a % 360) + 360) % 360;
const fixHour = (h) => ((h % 24) + 24) % 24;

function julianDay(year, month, day) {
  if (month <= 2) { year -= 1; month += 12; }
  const A = Math.floor(year / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + B - 1524.5;
}

// Sun declination and equation of time for a Julian day
function sunPosition(jd) {
  const D = jd - 2451545.0;
  const g = fixAngle(357.529 + 0.98560028 * D);
  const q = fixAngle(280.459 + 0.98564736 * D);
  const L = fixAngle(q + 1.915 * sin(g) + 0.02 * sin(2 * g));
  const e = 23.439 - 0.00000036 * D;
  const RA = fixHour(arctan2(cos(e) * sin(L), cos(L)) / 15);
  return { declination: arcsin(sin(e) * sin(L)), equation: q / 15 - RA };
}

/** "5:07" style text -> "05:07" (24 hours). NaN (sun never reaches that angle) -> null. */
function clock(hours) {
  if (!Number.isFinite(hours)) return null;
  const total = Math.round(fixHour(hours) * 60) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * Prayer times of ONE day at a place.
 * @param {{year:number, month:number, day:number}} date  month 1-12
 * @param {{latitude:number, longitude:number}} place
 * @param {{method?:number, school?:0|1, tzOffsetHours:number, adjust?:{Fajr?:number,Dhuhr?:number,Asr?:number,Maghrib?:number,Isha?:number}}} opts
 *   school 1 = Hanafi Asr (shadow = 2x), 0 = the others (shadow = 1x). tzOffsetHours = UTC offset of that day, e.g. 5 for Pakistan.
 * @returns {{Imsak,Fajr,Sunrise,Dhuhr,Asr,Maghrib,Isha}} 24-hour "HH:MM" texts
 */
export function calculateTimes(date, place, { method = 1, school = 1, tzOffsetHours, adjust = {} } = {}) {
  const { latitude: lat, longitude: lng } = place;
  const params = METHODS[method] || METHODS[FALLBACK_METHOD];
  const jd = julianDay(date.year, date.month, date.day) - lng / (15 * 24);

  const midDay = (t) => fixHour(12 - sunPosition(jd + t).equation);
  const angleTime = (angle, t, ccw) => {
    const decl = sunPosition(jd + t).declination;
    const noon = midDay(t);
    const x = (-sin(angle) - sin(decl) * sin(lat)) / (cos(decl) * cos(lat));
    const part = arccos(x) / 15; // NaN when the sun never gets that far (very high latitudes)
    return noon + (ccw ? -part : part);
  };
  const asrTime = (factor, t) => {
    const decl = sunPosition(jd + t).declination;
    const angle = -arccot(factor + tan(Math.abs(lat - decl)));
    return angleTime(angle, t, false);
  };

  // two passes: the sun moves during the day, so the second pass uses the first pass' times
  let t = { fajr: 5, sunrise: 6, dhuhr: 12, asr: 13, sunset: 18, isha: 18 };
  for (let pass = 0; pass < 2; pass++) {
    const d = (h) => h / 24;
    t = {
      fajr: angleTime(params.fajr, d(t.fajr), true),
      sunrise: angleTime(0.833, d(t.sunrise), true),
      dhuhr: midDay(d(t.dhuhr)),
      asr: asrTime(school === 1 ? 2 : 1, d(t.asr)),
      sunset: angleTime(0.833, d(t.sunset), false),
      isha: params.ishaMinutes ? 0 : angleTime(params.isha, d(t.isha), false),
    };
    // keep the numbers finite for the next pass when the sun never reaches an angle
    Object.keys(t).forEach((k) => { if (!Number.isFinite(t[k])) t[k] = { fajr: 5, sunrise: 6, isha: 18, sunset: 18 }[k] ?? 12; });
  }

  // sun never reaches the Fajr / Isha angle (summer in the far north): use one seventh of the night
  const raw = {
    fajr: angleTime(params.fajr, t.fajr / 24, true),
    sunrise: angleTime(0.833, t.sunrise / 24, true),
    dhuhr: midDay(t.dhuhr / 24),
    asr: asrTime(school === 1 ? 2 : 1, t.asr / 24),
    sunset: angleTime(0.833, t.sunset / 24, false),
  };
  raw.isha = params.ishaMinutes ? raw.sunset + params.ishaMinutes / 60 : angleTime(params.isha, t.isha / 24, false);
  const night = fixHour(raw.sunrise - raw.sunset);
  if (!Number.isFinite(raw.fajr)) raw.fajr = raw.sunrise - night / 7;
  if (!Number.isFinite(raw.isha)) raw.isha = raw.sunset + night / 7;

  const shift = tzOffsetHours - lng / 15;
  const m = (min) => (Number.isFinite(min) ? min / 60 : 0);
  const out = {
    Fajr: raw.fajr + shift + m(adjust.Fajr),
    Sunrise: raw.sunrise + shift,
    Dhuhr: raw.dhuhr + shift + m(adjust.Dhuhr) + 1 / 60, // +1 minute after the sun passes the middle, as other calculators do
    Asr: raw.asr + shift + m(adjust.Asr),
    Maghrib: raw.sunset + shift + m(adjust.Maghrib),
    Isha: raw.isha + shift + m(adjust.Isha),
  };
  return {
    Imsak: clock(out.Fajr - 10 / 60),
    Fajr: clock(out.Fajr),
    Sunrise: clock(out.Sunrise),
    Dhuhr: clock(out.Dhuhr),
    Asr: clock(out.Asr),
    Maghrib: clock(out.Maghrib),
    Isha: clock(out.Isha),
  };
}

/** Hijri (Umm al-Qura) date text from the device, e.g. "28 Rabiʻ II 1448". Falls back to "". */
export function hijriText(jsDate) {
  try {
    const parts = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { day: "numeric", month: "long", year: "numeric" }).formatToParts(jsDate);
    const get = (type) => (parts.find((p) => p.type === type) || {}).value || "";
    const year = get("year").replace(/\s*AH$/i, "");
    return `${get("day")} ${get("month")} ${year}`.trim();
  } catch (e) {
    return "";
  }
}

const pad = (n) => String(n).padStart(2, "0");

/**
 * The same object shape as GET /prayer/times, calculated on this device.
 * @param {{latitude:number, longitude:number}} place
 * @param {Date} when    any moment of the day wanted (in the device's time zone)
 */
export function offlinePrayerData(place, when = new Date(), { method = 1, school = 1, adjust = {} } = {}) {
  const date = { year: when.getFullYear(), month: when.getMonth() + 1, day: when.getDate() };
  const noon = new Date(date.year, date.month - 1, date.day, 12, 0, 0);
  const tzOffsetHours = -noon.getTimezoneOffset() / 60;
  const timings = calculateTimes(date, place, { method, school, tzOffsetHours, adjust });
  let timezone = null;
  try { timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch (e) { /* keep null */ }
  return {
    timings,
    timezone,
    hijri: null,
    hijriDate: hijriText(noon),
    gregorianDate: `${pad(date.day)}-${pad(date.month)}-${date.year}`,
    requestedDate: `${pad(date.day)}-${pad(date.month)}-${date.year}`,
    source: "device", // the page shows a small note for this
  };
}

export const SUPPORTED_METHODS = Object.keys(METHODS).map(Number);
