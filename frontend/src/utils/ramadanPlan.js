// Pure helpers for the Ramadan Quran plan and the fasting record (no React, unit-tested).

export const QURAN_PAGES = 604; // pages of the standard Madinah Mushaf layout used by the Quran API
export const PLAN_DAYS = [10, 15, 20, 30, 40, 60];

/** Whole number from 1 to 604, otherwise `fallback`. */
export function clampPlanDays(value, fallback = 30) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= QURAN_PAGES ? n : fallback;
}

/**
 * Pages to read on day `day` (1-based) of a plan that finishes the Quran in `days` days.
 * The 604 pages are spread evenly (for 30 days: 20 or 21 pages a day) and the last day ends on page 604.
 * Returns null when `day` is outside the plan.
 */
export function pageRangeForDay(day, days) {
  const total = clampPlanDays(days);
  if (!Number.isInteger(day) || day < 1 || day > total) return null;
  const start = Math.floor(((day - 1) * QURAN_PAGES) / total) + 1;
  const end = Math.floor((day * QURAN_PAGES) / total);
  return { start, end, count: end - start + 1 };
}

/** Longest run of consecutive day numbers in a list/set, e.g. [1,2,3,5,6] -> 3. */
export function longestRun(days) {
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  let prev = null;
  sorted.forEach((d) => {
    run = prev !== null && d === prev + 1 ? run + 1 : 1;
    if (run > best) best = run;
    prev = d;
  });
  return best;
}

/**
 * Consecutive fasted days counting back from `upToDay`.
 * If `upToDay` itself is not marked yet (the day is still going), counting starts from the day before.
 */
export function currentRun(days, upToDay) {
  const set = new Set(days);
  let d = set.has(upToDay) ? upToDay : upToDay - 1;
  let run = 0;
  while (d >= 1 && set.has(d)) { run += 1; d -= 1; }
  return run;
}

/** "in 3 days", "tomorrow", "today" */
export function daysLabel(n) {
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  return `in ${n} days`;
}
