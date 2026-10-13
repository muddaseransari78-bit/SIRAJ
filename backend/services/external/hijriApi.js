const axios = require("axios");
const cache = require("../../utils/cache");
const { normalizeDay, normalizeTimetable } = require("../../utils/hijriShape");

// Same AlAdhan service as the prayer times (PRAYER_API_BASE_URL can point to a mirror).
const client = axios.create({
  baseURL: process.env.PRAYER_API_BASE_URL || "https://api.aladhan.com/v1",
  timeout: 10000,
});

const DAY = 60 * 60 * 24;
/** Gregorian "DD-MM-YYYY" -> Hijri (calculated, may differ by a day from moon sighting). */
async function gregorianToHijri(dmy) {
  const key = `hijri:g2h:${dmy}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const res = await client.get(`/gToH/${dmy}`);
  const out = normalizeDay(res.data.data);
  cache.set(key, out, DAY);
  return out;
}

/** Hijri "DD-MM-YYYY" -> Gregorian. */
async function hijriToGregorian(dmy) {
  const key = `hijri:h2g:${dmy}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const res = await client.get(`/hToG/${dmy}`);
  const out = normalizeDay(res.data.data);
  cache.set(key, out, DAY * 7); // a calculated conversion does not change
  return out;
}

/**
 * All days of Ramadan (Hijri month 9) of one Hijri year with Imsak / Fajr / Maghrib for a place.
 * Place = latitude+longitude OR city+country.
 */
async function getRamadanTimetable({ hijriYear, latitude, longitude, city, country, method = 3, school = 0, tune = "" }) {
  const byCity = !!city;
  const place = byCity ? `c:${String(city).toLowerCase()}:${String(country || "").toLowerCase()}` : `g:${Number(latitude).toFixed(2)}:${Number(longitude).toFixed(2)}`;
  const key = `ramadan:table:${hijriYear}:${place}:${method}:${school}:${tune}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const params = { method, school };
  if (tune) params.tune = tune;
  let url;
  if (byCity) {
    url = `/hijriCalendarByCity/${hijriYear}/9`;
    params.city = city;
    params.country = country;
  } else {
    url = `/hijriCalendar/${hijriYear}/9`;
    params.latitude = latitude;
    params.longitude = longitude;
  }

  const res = await client.get(url, { params });
  const out = normalizeTimetable(hijriYear, res.data.data);
  cache.set(key, out, 60 * 60 * 12);
  return out;
}

module.exports = { gregorianToHijri, hijriToGregorian, getRamadanTimetable };
