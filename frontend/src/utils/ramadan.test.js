import test from "node:test";
import assert from "node:assert";
import {
  buildRamadanEvents, formatCountdown, momentOf, ramadanCountdown, sanitizeReminders,
} from "./ramadanSchedule.js";
import { QURAN_PAGES, clampPlanDays, currentRun, daysLabel, longestRun, pageRangeForDay } from "./ramadanPlan.js";

// Day data in the shape of GET /api/prayer/times (zone Asia/Karachi = UTC+5, no daylight saving).
const day = (gregorianDate, imsak, maghrib, monthNumber = 9) => ({
  gregorianDate,
  timezone: "Asia/Karachi",
  timings: { Imsak: imsak, Fajr: "05:00", Maghrib: maghrib },
  hijri: { day: 10, monthNumber, year: 1448 },
});
const TODAY = day("02-03-2027", "04:50 (PKT)", "18:10 (PKT)");
const TOMORROW = day("03-03-2027", "04:49 (PKT)", "18:11 (PKT)");
const at = (iso, hhmm) => Date.parse(`${iso}T${hhmm}:00+05:00`);

test("momentOf reads the time in the place's zone", () => {
  assert.strictEqual(momentOf(TODAY, "Imsak"), at("2027-03-02", "04:50"));
  assert.strictEqual(momentOf(TODAY, "Maghrib"), at("2027-03-02", "18:10"));
  assert.strictEqual(momentOf(TODAY, "Isha"), null);
  assert.strictEqual(momentOf(null, "Imsak"), null);
});

test("countdown: before Imsak, before Iftar, after Iftar", () => {
  const a = ramadanCountdown(at("2027-03-02", "03:00"), TODAY, TOMORROW);
  assert.strictEqual(a.kind, "sehri");
  assert.strictEqual(a.at, at("2027-03-02", "04:50"));

  const b = ramadanCountdown(at("2027-03-02", "12:00"), TODAY, TOMORROW);
  assert.strictEqual(b.kind, "iftar");
  assert.strictEqual(b.at, at("2027-03-02", "18:10"));

  // exactly at Imsak the Sehri time has passed -> Iftar is next
  assert.strictEqual(ramadanCountdown(at("2027-03-02", "04:50"), TODAY, TOMORROW).kind, "iftar");

  const c = ramadanCountdown(at("2027-03-02", "20:00"), TODAY, TOMORROW);
  assert.strictEqual(c.kind, "sehri");
  assert.strictEqual(c.at, at("2027-03-03", "04:49"));
  assert.strictEqual(c.approximate, false);
});

test("countdown after Iftar without tomorrow's times is marked approximate", () => {
  const c = ramadanCountdown(at("2027-03-02", "20:00"), TODAY, null);
  assert.strictEqual(c.approximate, true);
  assert.strictEqual(c.at, at("2027-03-02", "04:50") + 24 * 3600 * 1000);
  assert.strictEqual(ramadanCountdown(Date.now(), null, null), null);
});

test("countdown falls back to Fajr when there is no Imsak", () => {
  const noImsak = { ...TODAY, timings: { Fajr: "05:00", Maghrib: "18:10" } };
  assert.strictEqual(ramadanCountdown(at("2027-03-02", "03:00"), noImsak, null).at, at("2027-03-02", "05:00"));
});

test("formatCountdown", () => {
  assert.strictEqual(formatCountdown(3725000), "01:02:05");
  assert.strictEqual(formatCountdown(-5000), "00:00:00");
  assert.strictEqual(formatCountdown(0), "00:00:00");
});

test("reminder settings are sanitised", () => {
  assert.deepStrictEqual(sanitizeReminders(null), { enabled: false, sehriBefore: 30, iftarBefore: 10, iftarAt: true });
  assert.deepStrictEqual(sanitizeReminders({ enabled: true, sehriBefore: 15, iftarBefore: 0, iftarAt: false }), { enabled: true, sehriBefore: 15, iftarBefore: 0, iftarAt: false });
  assert.strictEqual(sanitizeReminders({ sehriBefore: -4 }).sehriBefore, 30);
  assert.strictEqual(sanitizeReminders({ sehriBefore: 999 }).sehriBefore, 30);
  assert.strictEqual(sanitizeReminders({ iftarBefore: "10" }).iftarBefore, 10);
});

test("reminder events: Sehri before, Iftar before, Iftar at", () => {
  const events = buildRamadanEvents([TODAY], { enabled: true, sehriBefore: 30, iftarBefore: 10, iftarAt: true });
  assert.deepStrictEqual(events.map((e) => e.key), ["2027-03-02:sehri:before", "2027-03-02:iftar:before", "2027-03-02:iftar:at"]);
  assert.strictEqual(events[0].fireAt, at("2027-03-02", "04:20"));
  assert.strictEqual(events[0].body, "Sehri ends in 30 minutes. (Imsak 04:50)");
  assert.strictEqual(events[1].fireAt, at("2027-03-02", "18:00"));
  assert.strictEqual(events[2].body, "It is time for Iftar. (Maghrib 18:10)");
  assert.ok(events.every((e) => e.adhan === false && e.url === "/ramadan"));
});

test("reminder events: off, zero minutes, and days outside Ramadan", () => {
  assert.deepStrictEqual(buildRamadanEvents([TODAY], { enabled: false }), []);
  const only = buildRamadanEvents([TODAY], { enabled: true, sehriBefore: 0, iftarBefore: 0, iftarAt: true });
  assert.deepStrictEqual(only.map((e) => e.key), ["2027-03-02:iftar:at"]);
  const eid = day("03-03-2027", "04:49", "18:11", 10); // 1 Shawwal
  assert.deepStrictEqual(buildRamadanEvents([eid, null], { enabled: true }), []);
  const two = buildRamadanEvents([TOMORROW, TODAY], { enabled: true });
  assert.strictEqual(two.length, 6);
  assert.ok(two[0].fireAt <= two[5].fireAt); // sorted
});

test("one minute is singular", () => {
  const e = buildRamadanEvents([TODAY], { enabled: true, sehriBefore: 1, iftarBefore: 0, iftarAt: false });
  assert.strictEqual(e[0].body, "Sehri ends in 1 minute. (Imsak 04:50)");
});

test("Quran plan: 30 days cover pages 1-604 once, with no gap and no overlap", () => {
  let expectedStart = 1;
  for (let d = 1; d <= 30; d++) {
    const r = pageRangeForDay(d, 30);
    assert.strictEqual(r.start, expectedStart, `day ${d}`);
    assert.ok(r.count === 20 || r.count === 21, `day ${d} has ${r.count} pages`);
    expectedStart = r.end + 1;
  }
  assert.strictEqual(expectedStart, QURAN_PAGES + 1);
  assert.deepStrictEqual(pageRangeForDay(1, 30), { start: 1, end: 20, count: 20 });
  assert.strictEqual(pageRangeForDay(30, 30).end, 604);
});

test("Quran plan works for every offered length", () => {
  [10, 15, 20, 30, 40, 60, 1, 604].forEach((days) => {
    let next = 1;
    for (let d = 1; d <= days; d++) {
      const r = pageRangeForDay(d, days);
      assert.strictEqual(r.start, next);
      assert.ok(r.count >= 1);
      next = r.end + 1;
    }
    assert.strictEqual(next, 605, `${days} days`);
  });
});

test("Quran plan: outside the plan and bad input", () => {
  assert.strictEqual(pageRangeForDay(0, 30), null);
  assert.strictEqual(pageRangeForDay(31, 30), null);
  assert.strictEqual(pageRangeForDay(1.5, 30), null);
  assert.strictEqual(clampPlanDays("15"), 15);
  assert.strictEqual(clampPlanDays("0"), 30);
  assert.strictEqual(clampPlanDays("abc"), 30);
  assert.strictEqual(clampPlanDays(605), 30);
});

test("fasting runs", () => {
  assert.strictEqual(longestRun([1, 2, 3, 5, 6]), 3);
  assert.strictEqual(longestRun([]), 0);
  assert.strictEqual(longestRun(new Set([4])), 1);
  assert.strictEqual(longestRun([3, 3, 2]), 2);
  assert.strictEqual(currentRun([1, 2, 3, 5], 5), 1);
  assert.strictEqual(currentRun([1, 2, 3], 4), 3); // today (4) not marked yet: counts back from yesterday
  assert.strictEqual(currentRun([1, 2, 3], 6), 0);
  assert.strictEqual(currentRun(new Set(), 3), 0);
});

test("days label", () => {
  assert.strictEqual(daysLabel(0), "today");
  assert.strictEqual(daysLabel(1), "tomorrow");
  assert.strictEqual(daysLabel(12), "in 12 days");
});
