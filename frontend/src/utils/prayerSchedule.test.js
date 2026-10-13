import test from "node:test";
import assert from "node:assert";
import {
  wallTimeToEpoch, buildSchedule, dueEvents, nextPrayer, tuneFromSettings, mergeSettings, dmyToISO,
  jamaatMoments, jamaatStatus, fmt12, fmt12At, withDefaults,
} from "./prayerSchedule.js";

const data = {
  gregorianDate: "02-10-2026",
  timezone: "Asia/Karachi", // UTC+5, no daylight saving
  timings: { Fajr: "04:55", Sunrise: "06:10", Dhuhr: "12:05", Asr: "15:30 (PKT)", Maghrib: "17:55", Isha: "19:15" },
};

test("wall time in a time zone becomes the right moment", () => {
  assert.strictEqual(wallTimeToEpoch("2026-10-02", "04:55", "Asia/Karachi"), Date.UTC(2026, 9, 1, 23, 55));
  assert.strictEqual(wallTimeToEpoch("2026-01-15", "12:00", "America/New_York"), Date.UTC(2026, 0, 15, 17, 0));
  assert.strictEqual(wallTimeToEpoch("2026-07-15", "12:00", "America/New_York"), Date.UTC(2026, 6, 15, 16, 0)); // summer time
  assert.strictEqual(wallTimeToEpoch("2026-10-02", "15:30 (PKT)", "Asia/Karachi"), Date.UTC(2026, 9, 2, 10, 30));
});

test("no notifications when reminders are off", () => {
  assert.deepStrictEqual(buildSchedule(data, { notificationsEnabled: false }), []);
});

test("reminder at prayer time uses the default message", () => {
  const ev = buildSchedule(data, { notificationsEnabled: true, jamaatEnabled: false });
  assert.strictEqual(ev.length, 5);
  const fajr = ev.find((e) => e.name === "Fajr");
  assert.match(fajr.body, /^It is time for Fajr Salah\./);
  assert.strictEqual(fajr.fireAt, Date.UTC(2026, 9, 1, 23, 55));
  assert.strictEqual(fajr.adhan, false);
});

test("'before' gives two events: warning + at time; per-prayer value beats the global one", () => {
  const ev = buildSchedule(data, { notificationsEnabled: true, minutesBefore: 10, before: { Asr: 5, Isha: 0 } });
  const fajr = ev.filter((e) => e.name === "Fajr");
  assert.strictEqual(fajr.length, 2);
  assert.strictEqual(fajr[0].type, "before");
  assert.strictEqual(fajr[1].fireAt - fajr[0].fireAt, 10 * 60000);
  assert.match(fajr[0].body, /^Fajr prayer is in 10 minutes\./);
  assert.strictEqual(ev.filter((e) => e.name === "Asr")[0].fireAt, wallTimeToEpoch("2026-10-02", "15:25", "Asia/Karachi"));
  assert.strictEqual(ev.filter((e) => e.name === "Isha").length, 1); // 0 = only at prayer time
});

test("disabled prayer, custom message and adhan per prayer", () => {
  const ev = buildSchedule(data, {
    notificationsEnabled: true, adhanEnabled: true,
    perPrayer: { Dhuhr: false }, adhanPer: { Asr: false }, customMessage: { Maghrib: "Break your fast" },
  });
  assert.strictEqual(ev.some((e) => e.name === "Dhuhr"), false);
  assert.strictEqual(ev.find((e) => e.name === "Asr").adhan, false);
  assert.strictEqual(ev.find((e) => e.name === "Fajr").adhan, true);
  assert.strictEqual(ev.find((e) => e.name === "Maghrib").body, "Break your fast");
});

test("due events: fire once, ignore old ones", () => {
  const ev = buildSchedule(data, { notificationsEnabled: true });
  const fajrAt = ev[0].fireAt;
  assert.strictEqual(dueEvents(ev, fajrAt - 1000, new Set()).length, 0);
  assert.strictEqual(dueEvents(ev, fajrAt + 1000, new Set()).length, 1);
  assert.strictEqual(dueEvents(ev, fajrAt + 1000, new Set([ev[0].key])).length, 0);
  assert.strictEqual(dueEvents(ev, fajrAt + 10 * 60000, new Set()).length, 0); // too old
});

test("next prayer, including after Isha", () => {
  const noon = wallTimeToEpoch("2026-10-02", "13:00", "Asia/Karachi");
  assert.strictEqual(nextPrayer(data, noon).name, "Asr");
  const night = wallTimeToEpoch("2026-10-02", "22:00", "Asia/Karachi");
  const n = nextPrayer(data, night);
  assert.strictEqual(n.name, "Fajr"); assert.strictEqual(n.approximate, true);
});

test("manual adjustment string and merge helper", () => {
  assert.strictEqual(tuneFromSettings({ adjust: {} }), "");
  assert.strictEqual(tuneFromSettings({ adjust: { Fajr: 2, Isha: -1 } }), "2,2,0,0,0,0,0,-1,0");
  const m = mergeSettings({ before: { Fajr: 5 }, minutesBefore: 0 }, { before: { Asr: 10 } });
  assert.deepStrictEqual(m.before, { Fajr: 5, Asr: 10 });
  assert.strictEqual(dmyToISO("02-10-2026"), "2026-10-02");
});

// ---------- Phase 31: Jamaat ----------

test("Jamaat: Zuhar 1:30 PM and Asr 4:30 PM by default, different from the prayer start", () => {
  const d = { ...data, timings: { ...data.timings, Dhuhr: "12:05", Asr: "15:20" } };
  const j = jamaatMoments(d, {});
  assert.strictEqual(j.Dhuhr.at, wallTimeToEpoch("2026-10-02", "13:30", "Asia/Karachi"));
  assert.strictEqual(j.Asr.at, wallTimeToEpoch("2026-10-02", "16:30", "Asia/Karachi"));
  assert.strictEqual(j.Fajr, undefined);
  assert.strictEqual(fmt12At(j.Asr.at, "Asia/Karachi"), "4:30 PM");
});

test("Jamaat is never before the start (summer Asr), offset Jamaat, Jamaat off", () => {
  const summer = { ...data, timings: { ...data.timings, Asr: "17:20" } };
  const j = jamaatMoments(summer, {});
  assert.strictEqual(j.Asr.clamped, true);
  assert.strictEqual(j.Asr.at, wallTimeToEpoch("2026-10-02", "17:20", "Asia/Karachi"));
  const o = jamaatMoments(data, { jamaatMode: { Maghrib: "offset" }, jamaatOffset: { Maghrib: 5 } });
  assert.strictEqual(o.Maghrib.at, wallTimeToEpoch("2026-10-02", "18:00", "Asia/Karachi"));
  assert.deepStrictEqual(jamaatMoments(data, { jamaatEnabled: false }), {});
});

test("Jamaat status: waiting between the start and Jamaat, then the next Jamaat", () => {
  const d = { ...data, timings: { ...data.timings, Dhuhr: "12:05", Asr: "15:20" } };
  const noon = wallTimeToEpoch("2026-10-02", "12:30", "Asia/Karachi");
  const s1 = jamaatStatus(d, {}, noon);
  assert.strictEqual(s1.waiting.name, "Dhuhr");
  assert.strictEqual(s1.next.name, "Dhuhr");
  const after = wallTimeToEpoch("2026-10-02", "14:00", "Asia/Karachi"); // Zuhar Jamaat over, Asr not started
  const s2 = jamaatStatus(d, {}, after);
  assert.strictEqual(s2.waiting, null);
  assert.strictEqual(s2.next.name, "Asr");
  const night = wallTimeToEpoch("2026-10-02", "21:00", "Asia/Karachi");
  assert.deepStrictEqual(jamaatStatus(d, {}, night), { waiting: null, next: null });
});

test("Jamaat reminders: before + now, with 12-hour text", () => {
  const ev = buildSchedule(data, { notificationsEnabled: true }).filter((e) => e.name === "Dhuhr");
  assert.deepStrictEqual(ev.map((e) => e.type), ["at", "jbefore", "jat"]);
  assert.match(ev[1].body, /^Dhuhr Jamaat is in 10 minutes\. \(1:30 PM\)/);
  assert.strictEqual(fmt12("13:30"), "1:30 PM");
  assert.strictEqual(withDefaults({}).school, 1);
});
