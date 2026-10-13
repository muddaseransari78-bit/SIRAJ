// The user's LOCAL date as "YYYY-MM-DD" (so "today" is correct in every time zone).
export function localDate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// The user's LOCAL date as "DD-MM-YYYY" (the format the prayer-times API wants).
export function localDateDMY(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${day}-${m}-${y}`;
}

// "08-02-2027" (DD-MM-YYYY) -> "8 Feb 2027" or, with weekday, "Mon, 8 Feb 2027". Same text in every time zone.
export function formatDMY(dmy, withWeekday = false) {
  const [d, m, y] = String(dmy).split("-").map(Number);
  if (!d || !m || !y) return String(dmy);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    timeZone: "UTC", day: "numeric", month: "short", year: "numeric", ...(withWeekday ? { weekday: "short" } : {}),
  });
}

// The same day +n (can be negative), from a Date. Used for "tomorrow".
export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

// Same as formatDMY but in the chosen interface language (e.g. "en-GB", "ur-PK", "ar").
export function formatDMYLocale(dmy, withWeekday = false, locale = "en-GB") {
  const [d, m, y] = String(dmy).split("-").map(Number);
  if (!d || !m || !y) return String(dmy);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(locale, {
    timeZone: "UTC", day: "numeric", month: "short", year: "numeric", ...(withWeekday ? { weekday: "short" } : {}),
  });
}
