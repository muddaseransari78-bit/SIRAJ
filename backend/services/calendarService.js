const axios = require("axios");
const cache = require("../utils/cache");
const hijriApi = require("./external/hijriApi");
const { EVENTS, UPCOMING_EVENTS, HIJRI_MONTHS, pickUpcoming } = require("../utils/hijriEvents");

const { makeIslamicClient } = require("../utils/islamicClient");
const client = makeIslamicClient(10000);

const pad = (n) => String(n).padStart(2, "0");

/**
 * Returns each day of a Gregorian month with its Hijri date and any event.
 * NOTE: dates are calculated; actual start of months depends on moon sighting.
 */
async function getMonth(month, year) {
  const key = `calendar:${year}-${month}`;
  const cached = cache.get(key);
  if (cached) return cached;

  let rows;
  try {
    rows = (await client.get(`/v1/hijri/calendar/${month}/${year}`)).data.data;
  } catch (e) {
    console.warn("[SIRAJ] islamic.app calendar failed, using AlAdhan:", e.response ? e.response.status : e.message);
    rows = await hijriApi.gregorianMonthCalendar(month, year);
  }

  const days = rows.map((d) => {
    const hm = d.hijri?.month?.number;
    const hd = Number(d.hijri?.day);
    const events = EVENTS.filter((e) => e.month === hm && e.day === hd);
    return {
      gregorianDay: Number(d.gregorian?.day),
      weekday: d.gregorian?.weekday?.en,
      hijriDay: hd,
      hijriMonth: d.hijri?.month?.en,
      hijriMonthNumber: hm,
      hijriYear: Number(d.hijri?.year),
      events,
    };
  });

  cache.set(key, days, 60 * 60 * 12);
  return days;
}

/** The dates of every listed event in ONE Hijri year (one conversion call per event). */
async function eventsForHijriYear(hijriYear) {
  const key = `calendar:events:${hijriYear}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const settled = await Promise.allSettled(
    UPCOMING_EVENTS.map((e) => hijriApi.hijriToGregorian(`${pad(e.day)}-${pad(e.month)}-${hijriYear}`))
  );
  const items = [];
  settled.forEach((r, i) => {
    if (r.status !== "fulfilled") return;
    const e = UPCOMING_EVENTS[i];
    items.push({
      name: e.name,
      note: e.note,
      hijriDay: e.day,
      hijriMonthNumber: e.month,
      hijriMonthName: HIJRI_MONTHS[e.month - 1],
      hijriYear,
      gregorianDate: r.value.gregorian.date, // DD-MM-YYYY
      weekday: r.value.gregorian.weekday,
    });
  });
  if (items.length === 0) throw new Error("Could not convert any event date");
  cache.set(key, items, 60 * 60 * 24);
  return items;
}

/**
 * The next `limit` events counted from `todayDMY` (the user's local date, DD-MM-YYYY).
 * Looks at this Hijri year and, when fewer than `limit` remain, at the next one too.
 */
async function getUpcomingEvents(todayDMY, limit = 8) {
  const today = (await hijriApi.gregorianToHijri(todayDMY)).hijri;
  let items = pickUpcoming(await eventsForHijriYear(today.year), todayDMY, limit);
  if (items.length < limit) {
    const next = await eventsForHijriYear(today.year + 1);
    items = pickUpcoming([...items, ...next], todayDMY, limit);
  }
  return { hijriToday: today, events: items };
}

module.exports = { getMonth, getUpcomingEvents };