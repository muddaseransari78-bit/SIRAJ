// Turns AlAdhan answers into SIRAJ's shape. Pure code (no packages) so it can be unit-tested.

const clock = (t) => String(t || "").split(" ")[0]; // "05:10 (PKT)" -> "05:10"

/** One day from AlAdhan (gToH / hToG answer). */
function normalizeDay(d) {
  return {
    gregorian: {
      date: d.gregorian.date, // DD-MM-YYYY
      day: Number(d.gregorian.day),
      monthNumber: Number(d.gregorian.month.number),
      monthEn: d.gregorian.month.en,
      year: Number(d.gregorian.year),
      weekday: (d.gregorian.weekday && d.gregorian.weekday.en) || null,
    },
    hijri: {
      date: d.hijri.date, // DD-MM-YYYY
      day: Number(d.hijri.day),
      monthNumber: Number(d.hijri.month.number),
      monthEn: d.hijri.month.en,
      monthAr: d.hijri.month.ar,
      year: Number(d.hijri.year),
      weekday: (d.hijri.weekday && d.hijri.weekday.en) || null,
    },
  };
}

/** The "hijriCalendar" answer (array of days) -> { hijriYear, timezone, days[] }. */
function normalizeTimetable(hijriYear, list) {
  const items = Array.isArray(list) ? list : [];
  return {
    hijriYear,
    timezone: items[0] && items[0].meta && items[0].meta.timezone ? items[0].meta.timezone : null,
    days: items.map((item) => ({
      hijriDay: Number(item.date.hijri.day),
      gregorianDate: item.date.gregorian.date, // DD-MM-YYYY
      weekday: (item.date.gregorian.weekday && item.date.gregorian.weekday.en) || null,
      imsak: clock(item.timings.Imsak),
      fajr: clock(item.timings.Fajr),
      maghrib: clock(item.timings.Maghrib),
    })),
  };
}

module.exports = { clock, normalizeDay, normalizeTimetable };
