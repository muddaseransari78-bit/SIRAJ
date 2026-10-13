const axios = require("axios");
const cache = require("../../utils/cache");
const { CACHE_TTL_SECONDS } = require("../../config/constants");

const BASE_URL = process.env.PRAYER_API_BASE_URL || "https://api.aladhan.com/v1";
const client = axios.create({ baseURL: BASE_URL, timeout: 10000 });

// Order AlAdhan expects for the "tune" (manual minute adjustment) parameter
const TUNE_ORDER = ["Imsak", "Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Sunset", "Isha", "Midnight"];

/** "5,-3,0,..." -> "5,-3,0,0,0,0,0,0,0" (always 9 whole numbers between -30 and 30) or "" if all zero */
function normalizeTune(raw) {
  if (raw === undefined || raw === null || raw === "") return "";
  const parts = String(raw).split(",").map((p) => Number(p.trim()));
  if (parts.length > TUNE_ORDER.length || parts.some((n) => !Number.isInteger(n) || n < -30 || n > 30)) return null;
  while (parts.length < TUNE_ORDER.length) parts.push(0);
  return parts.every((n) => n === 0) ? "" : parts.join(",");
}

/** Today's date as DD-MM-YYYY (server date - only used when the browser did not send one). */
function todayDDMMYYYY() {
  const d = new Date();
  return `${String(d.getUTCDate()).padStart(2, "0")}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${d.getUTCFullYear()}`;
}

/**
 * Fetches prayer times for ONE day.
 * Location = latitude+longitude OR city+country.
 * method: AlAdhan calculation method ID (default 1 = Karachi). school: 0 = Shafi/Maliki/Hanbali (Asr earlier), 1 = Hanafi (default).
 * date: DD-MM-YYYY (the USER's local date, so "today" is right in every time zone).
 * tune: 9 comma separated minute adjustments (see TUNE_ORDER).
 */
async function getPrayerTimes({ latitude, longitude, city, country, method = 1, school = 1, date, tune = "" }) {
  const day = date || todayDDMMYYYY();
  const byCity = !!city;
  const place = byCity ? `c:${city.toLowerCase()}:${(country || "").toLowerCase()}` : `g:${Number(latitude).toFixed(2)}:${Number(longitude).toFixed(2)}`;
  const cacheKey = `prayer:${place}:${method}:${school}:${tune}:${day}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const params = { method, school };
  if (tune) params.tune = tune;
  let url;
  if (byCity) {
    url = `/timingsByCity/${day}`;
    params.city = city;
    params.country = country;
  } else {
    url = `/timings/${day}`;
    params.latitude = latitude;
    params.longitude = longitude;
  }

  const response = await client.get(url, { params });
  const { timings, date: d, meta } = response.data.data;

  const result = {
    timings: {
      Imsak: timings.Imsak,
      Fajr: timings.Fajr,
      Sunrise: timings.Sunrise,
      Dhuhr: timings.Dhuhr,
      Asr: timings.Asr,
      Maghrib: timings.Maghrib,
      Isha: timings.Isha,
    },
    timezone: meta && meta.timezone ? meta.timezone : null, // e.g. "Asia/Karachi" - times above are in THIS zone
    hijri: {
      day: Number(d.hijri.day),
      monthNumber: Number(d.hijri.month.number),
      monthEn: d.hijri.month.en,
      monthAr: d.hijri.month.ar,
      year: Number(d.hijri.year),
    },
    hijriDate: `${d.hijri.day} ${d.hijri.month.en} ${d.hijri.year}`,
    gregorianDate: d.gregorian.date,
    requestedDate: day,
  };

  cache.set(cacheKey, result, CACHE_TTL_SECONDS.PRAYER_TIMES);
  return result;
}

// Old name kept so any older code keeps working
const getTodayPrayerTimes = (opts) => getPrayerTimes(opts);

module.exports = { getPrayerTimes, getTodayPrayerTimes, normalizeTune, TUNE_ORDER };
