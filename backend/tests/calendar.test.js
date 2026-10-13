const test = require("node:test");
const assert = require("node:assert");
const { parseDMY, parseHijriDMY, daysBetweenDMY } = require("../utils/dates");
const { EVENTS, UPCOMING_EVENTS, ramadanTarget, pickUpcoming } = require("../utils/hijriEvents");
const { normalizeDay, normalizeTimetable } = require("../utils/hijriShape");

test("parseDMY accepts real days only", () => {
  assert.deepStrictEqual(parseDMY("02-10-2026"), { d: 2, m: 10, y: 2026 });
  assert.strictEqual(parseDMY("31-02-2026"), null);
  assert.strictEqual(parseDMY("2026-10-02"), null);
  assert.strictEqual(parseDMY("2-10-2026"), null);
  assert.strictEqual(parseDMY(undefined), null);
  assert.deepStrictEqual(parseDMY("29-02-2028"), { d: 29, m: 2, y: 2028 }); // leap year
  assert.strictEqual(parseDMY("29-02-2027"), null);
});

test("parseHijriDMY checks the ranges only", () => {
  assert.deepStrictEqual(parseHijriDMY("01-09-1448"), { d: 1, m: 9, y: 1448 });
  assert.deepStrictEqual(parseHijriDMY("30-12-1448"), { d: 30, m: 12, y: 1448 });
  assert.strictEqual(parseHijriDMY("31-01-1448"), null);
  assert.strictEqual(parseHijriDMY("01-13-1448"), null);
  assert.strictEqual(parseHijriDMY("01-09-1200"), null);
  assert.strictEqual(parseHijriDMY("00-09-1448"), null);
});

test("daysBetweenDMY counts whole days, also across month and year ends", () => {
  assert.strictEqual(daysBetweenDMY("02-10-2026", "02-10-2026"), 0);
  assert.strictEqual(daysBetweenDMY("02-10-2026", "03-10-2026"), 1);
  assert.strictEqual(daysBetweenDMY("31-12-2026", "01-01-2027"), 1);
  assert.strictEqual(daysBetweenDMY("28-02-2028", "01-03-2028"), 2); // leap year
  assert.strictEqual(daysBetweenDMY("05-10-2026", "02-10-2026"), -3);
  assert.strictEqual(daysBetweenDMY("xx", "02-10-2026"), null);
});

test("ramadanTarget: before, during and after Ramadan", () => {
  assert.deepStrictEqual(ramadanTarget({ monthNumber: 3, year: 1448 }), { year: 1448, inProgress: false });
  assert.deepStrictEqual(ramadanTarget({ monthNumber: 8, year: 1448 }), { year: 1448, inProgress: false });
  assert.deepStrictEqual(ramadanTarget({ monthNumber: 9, year: 1448 }), { year: 1448, inProgress: true });
  assert.deepStrictEqual(ramadanTarget({ monthNumber: 10, year: 1448 }), { year: 1449, inProgress: false });
  assert.deepStrictEqual(ramadanTarget({ monthNumber: "12", year: "1448" }), { year: 1449, inProgress: false });
});

test("pickUpcoming drops past events, sorts soonest first and keeps the limit", () => {
  const items = [
    { name: "later", gregorianDate: "10-10-2026" },
    { name: "past", gregorianDate: "01-10-2026" },
    { name: "today", gregorianDate: "02-10-2026" },
    { name: "soon", gregorianDate: "05-10-2026" },
  ];
  const out = pickUpcoming(items, "02-10-2026", 2);
  assert.deepStrictEqual(out.map((i) => i.name), ["today", "soon"]);
  assert.deepStrictEqual(out.map((i) => i.daysUntil), [0, 3]);
});

test("event list: every entry is a valid Hijri day and the grid-only ones are not in the upcoming list", () => {
  EVENTS.forEach((e) => {
    assert.ok(e.month >= 1 && e.month <= 12, e.name);
    assert.ok(e.day >= 1 && e.day <= 30, e.name);
    assert.ok(e.name && e.note, e.name);
  });
  assert.ok(UPCOMING_EVENTS.length < EVENTS.length);
  assert.ok(UPCOMING_EVENTS.every((e) => e.upcoming !== false));
});

test("normalizeDay reads the AlAdhan shape", () => {
  const out = normalizeDay({
    gregorian: { date: "18-02-2026", day: "18", weekday: { en: "Wednesday" }, month: { number: 2, en: "February" }, year: "2026" },
    hijri: { date: "01-09-1447", day: "1", weekday: { en: "Al Arba'a" }, month: { number: 9, en: "Ramadan", ar: "رَمَضان" }, year: "1447" },
  });
  assert.strictEqual(out.gregorian.date, "18-02-2026");
  assert.strictEqual(out.gregorian.weekday, "Wednesday");
  assert.strictEqual(out.hijri.day, 1);
  assert.strictEqual(out.hijri.monthNumber, 9);
  assert.strictEqual(out.hijri.year, 1447);
});

test("normalizeTimetable strips the zone label from the times", () => {
  const out = normalizeTimetable(1448, [
    {
      timings: { Imsak: "04:52 (PKT)", Fajr: "05:02 (PKT)", Maghrib: "18:20 (PKT)" },
      date: { gregorian: { date: "08-02-2027", weekday: { en: "Monday" } }, hijri: { day: "1" } },
      meta: { timezone: "Asia/Karachi" },
    },
  ]);
  assert.strictEqual(out.timezone, "Asia/Karachi");
  assert.deepStrictEqual(out.days[0], { hijriDay: 1, gregorianDate: "08-02-2027", weekday: "Monday", imsak: "04:52", fajr: "05:02", maghrib: "18:20" });
  assert.deepStrictEqual(normalizeTimetable(1448, null).days, []);
});
