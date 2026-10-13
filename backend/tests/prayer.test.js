const test = require("node:test");
const assert = require("node:assert");
const { parseTimesQuery } = require("../controllers/prayerController");
const { normalizeTune } = require("../services/external/prayerApi");
const { buildSettingsUpdate } = require("../controllers/prayerUserController");

const code = (fn) => { try { fn(); return null; } catch (e) { return e.statusCode; } };

test("times query: coordinates are validated", () => {
  assert.deepStrictEqual(parseTimesQuery({ lat: "31.5", lng: "74.3" }), { latitude: 31.5, longitude: 74.3 });
  assert.strictEqual(code(() => parseTimesQuery({ lat: "999", lng: "74" })), 400);
  assert.strictEqual(code(() => parseTimesQuery({ lat: "abc", lng: "74" })), 400);
  assert.strictEqual(code(() => parseTimesQuery({})), 400);
});

test("times query: city fallback needs city AND country", () => {
  assert.deepStrictEqual(parseTimesQuery({ city: "Lahore", country: "Pakistan" }), { city: "Lahore", country: "Pakistan" });
  assert.strictEqual(code(() => parseTimesQuery({ city: "Lahore" })), 400);
});

test("times query: method, school, date, tune", () => {
  const q = parseTimesQuery({ lat: "1", lng: "1", method: "1", school: "1", date: "02-10-2026", tune: "0,2,0,0,0,0,0,0,0" });
  assert.strictEqual(q.method, 1); assert.strictEqual(q.school, 1);
  assert.strictEqual(q.date, "02-10-2026"); assert.strictEqual(q.tune, "0,2,0,0,0,0,0,0,0");
  assert.strictEqual(code(() => parseTimesQuery({ lat: "1", lng: "1", school: "2" })), 400);
  assert.strictEqual(code(() => parseTimesQuery({ lat: "1", lng: "1", date: "31-02-2026" })), 400);
  assert.strictEqual(code(() => parseTimesQuery({ lat: "1", lng: "1", date: "2026-10-02" })), 400);
});

test("tune: padded, limited to +-30, all-zero means none", () => {
  assert.strictEqual(normalizeTune("0,0,0"), "");
  assert.strictEqual(normalizeTune("1,2"), "1,2,0,0,0,0,0,0,0");
  assert.strictEqual(normalizeTune("99"), null);
  assert.strictEqual(normalizeTune("1.5"), null);
});

test("settings update: valid values are mapped to $set paths", () => {
  const u = buildSettingsUpdate({ school: 1, before: { Fajr: 15, Asr: null }, adjust: { Isha: -2 }, customMessage: { Fajr: " Wake up " }, adhanPer: { Dhuhr: false }, city: " Lahore " });
  assert.strictEqual(u.school, 1);
  assert.strictEqual(u["before.Fajr"], 15);
  assert.strictEqual(u["before.Asr"], null);
  assert.strictEqual(u["adjust.Isha"], -2);
  assert.strictEqual(u["customMessage.Fajr"], "Wake up");
  assert.strictEqual(u["adhanPer.Dhuhr"], false);
  assert.strictEqual(u.city, "Lahore");
});

test("settings update: bad values are rejected, unknown prayers ignored", () => {
  assert.strictEqual(code(() => buildSettingsUpdate({ school: 5 })), 400);
  assert.strictEqual(code(() => buildSettingsUpdate({ before: { Fajr: 99 } })), 400);
  assert.strictEqual(code(() => buildSettingsUpdate({ adjust: { Fajr: 31 } })), 400);
  assert.strictEqual(code(() => buildSettingsUpdate({ customMessage: { Fajr: "x".repeat(121) } })), 400);
  assert.deepStrictEqual(buildSettingsUpdate({ before: { Sunrise: 5 }, $where: "x" }), {});
});
