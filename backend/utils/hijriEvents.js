// Islamic events + the small pure functions around them (no packages, unit-tested).
const { daysBetweenDMY } = require("./dates");

const HIJRI_MONTHS = [
  "Muharram", "Safar", "Rabi' al-awwal", "Rabi' al-thani", "Jumada al-awwal", "Jumada al-thani",
  "Rajab", "Sha'ban", "Ramadan", "Shawwal", "Dhul-Qi'dah", "Dhul-Hijjah",
];

// Commonly observed Islamic dates (Hijri month number, day). Several are matters of
// scholarly difference - the UI labels them "commonly observed".
// upcoming:false = shown on the month grid only (keeps the "next events" list short).
const EVENTS = [
  { month: 1, day: 1, name: "Islamic New Year", note: "1 Muharram" },
  { month: 1, day: 10, name: "Day of Ashura", note: "10 Muharram" },
  { month: 3, day: 12, name: "Mawlid an-Nabi", note: "Commonly observed; scholars differ on observing it" },
  { month: 7, day: 27, name: "Isra and Mi'raj", note: "Commonly observed date" },
  { month: 8, day: 15, name: "Mid-Sha'ban", note: "Commonly observed date" },
  { month: 9, day: 1, name: "First day of Ramadan", note: "Subject to moon sighting" },
  { month: 9, day: 21, name: "Last ten nights of Ramadan", note: "Seek Laylat al-Qadr in the odd nights of the last ten" },
  { month: 9, day: 23, name: "Laylat al-Qadr (search)", note: "Seek it in the odd nights of the last ten", upcoming: false },
  { month: 9, day: 25, name: "Laylat al-Qadr (search)", note: "Seek it in the odd nights of the last ten", upcoming: false },
  { month: 9, day: 27, name: "Laylat al-Qadr (search)", note: "Seek it in the odd nights of the last ten", upcoming: false },
  { month: 9, day: 29, name: "Laylat al-Qadr (search)", note: "Seek it in the odd nights of the last ten", upcoming: false },
  { month: 10, day: 1, name: "Eid al-Fitr", note: "Subject to moon sighting" },
  { month: 12, day: 9, name: "Day of Arafah", note: "9 Dhul Hijjah" },
  { month: 12, day: 10, name: "Eid al-Adha", note: "10 Dhul Hijjah" },
];

/** Events that belong in the "coming up" list. */
const UPCOMING_EVENTS = EVENTS.filter((e) => e.upcoming !== false);

/**
 * Which Ramadan matters today? { monthNumber, year } is today's Hijri date.
 *  - during Ramadan: this year's, in progress
 *  - before Ramadan (Muharram..Sha'ban): this year's
 *  - after Ramadan (Shawwal..Dhul-Hijjah): next year's
 */
function ramadanTarget(hijriToday) {
  const month = Number(hijriToday.monthNumber);
  const year = Number(hijriToday.year);
  if (month === 9) return { year, inProgress: true };
  if (month < 9) return { year, inProgress: false };
  return { year: year + 1, inProgress: false };
}

/** Adds daysUntil (from todayDMY), drops past items, sorts soonest first, keeps `limit`. */
function pickUpcoming(items, todayDMY, limit = 8) {
  return items
    .map((item) => ({ ...item, daysUntil: daysBetweenDMY(todayDMY, item.gregorianDate) }))
    .filter((item) => item.daysUntil !== null && item.daysUntil >= 0)
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, limit);
}

module.exports = { HIJRI_MONTHS, EVENTS, UPCOMING_EVENTS, ramadanTarget, pickUpcoming };
