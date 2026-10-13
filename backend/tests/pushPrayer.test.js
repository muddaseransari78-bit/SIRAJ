// Phase 31 - Jamaat times + server push reminders (pure logic, no database / network needed).
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const S = require("../utils/prayerSchedule");
const push = require("../services/pushService");
const { buildSubscriptionDoc, secretMatches } = require("../controllers/pushController");
const { buildSettingsUpdate } = require("../controllers/prayerUserController");
const { makeVapidKeys } = require("../scripts/generate-vapid");
const { checkEnv } = require("../utils/envCheck");

const TZ = "Asia/Karachi"; // UTC+5, no daylight saving
const at = (iso, hhmm) => S.wallTimeToEpoch(iso, hhmm, TZ);
const data = {
  gregorianDate: "07-10-2026",
  timezone: TZ,
  timings: { Fajr: "04:55", Sunrise: "06:10", Dhuhr: "11:55", Asr: "15:20", Maghrib: "17:45", Isha: "19:05" },
};
const on = { notificationsEnabled: true };

// ---------- Jamaat calculation ----------

test("defaults: Zuhar Jamaat 1:30 PM and Asr Jamaat 4:30 PM, Hanafi Asr", () => {
  const s = S.withDefaults({});
  assert.strictEqual(s.school, 1);
  assert.strictEqual(s.jamaatMode.Dhuhr, "fixed");
  assert.strictEqual(s.jamaatTime.Dhuhr, "13:30");
  assert.strictEqual(s.jamaatTime.Asr, "16:30");
  assert.strictEqual(s.jamaatMode.Fajr, "off");
});

test("fixed Jamaat is a real clock time, different from the start", () => {
  const j = S.jamaatMoments(data, {});
  assert.strictEqual(j.Dhuhr.at, at("2026-10-07", "13:30"));
  assert.strictEqual(j.Asr.at, at("2026-10-07", "16:30"));
  assert.strictEqual(j.Dhuhr.clamped, false);
  assert.strictEqual(j.Fajr, undefined); // off
});

test("Jamaat can never be before the prayer starts (fixed Asr 4:30 PM in summer)", () => {
  const summer = { ...data, gregorianDate: "20-06-2026", timings: { ...data.timings, Asr: "17:20" } };
  const j = S.jamaatMoments(summer, {});
  assert.strictEqual(j.Asr.at, at("2026-06-20", "17:20")); // start time used
  assert.strictEqual(j.Asr.clamped, true);
});

test("offset Jamaat = start + N minutes; bad values give no Jamaat", () => {
  const j = S.jamaatMoments(data, { jamaatMode: { Maghrib: "offset" }, jamaatOffset: { Maghrib: 5 } });
  assert.strictEqual(j.Maghrib.at, at("2026-10-07", "17:50"));
  assert.strictEqual(S.jamaatMoments(data, { jamaatMode: { Isha: "fixed" }, jamaatTime: { Isha: "" } }).Isha, undefined);
  assert.strictEqual(S.jamaatMoments(data, { jamaatMode: { Isha: "fixed" }, jamaatTime: { Isha: "25:99" } }).Isha, undefined);
  assert.strictEqual(S.jamaatMoments(data, { jamaatEnabled: false }).Dhuhr, undefined);
});

test("12-hour text", () => {
  assert.strictEqual(S.fmt12("13:30"), "1:30 PM");
  assert.strictEqual(S.fmt12("00:05"), "12:05 AM");
  assert.strictEqual(S.fmt12("12:00 (PKT)"), "12:00 PM");
  assert.strictEqual(S.fmt12At(at("2026-10-07", "16:30"), TZ), "4:30 PM");
});

// ---------- reminder events ----------

test("a prayer gives start, 'Jamaat in 10 minutes' and 'Jamaat now' events in order", () => {
  const ev = S.buildSchedule(data, on).filter((e) => e.name === "Dhuhr");
  assert.deepStrictEqual(ev.map((e) => e.type), ["at", "jbefore", "jat"]);
  assert.strictEqual(ev[0].fireAt, at("2026-10-07", "11:55"));
  assert.strictEqual(ev[1].fireAt, at("2026-10-07", "13:20"));
  assert.strictEqual(ev[2].fireAt, at("2026-10-07", "13:30"));
  assert.match(ev[0].body, /^It is time for Dhuhr Salah\. \(11:55 AM\)/);
  assert.match(ev[1].body, /^Dhuhr Jamaat is in 10 minutes\. \(1:30 PM\)/);
  assert.match(ev[2].body, /^Dhuhr Jamaat is now\. \(1:30 PM\)/);
});

test("jamaatBefore 0 = only 'Jamaat now'; Jamaat at the very start is not announced twice; Jamaat off = none", () => {
  const ev0 = S.buildSchedule(data, { ...on, jamaatBefore: 0 }).filter((e) => e.name === "Asr");
  assert.deepStrictEqual(ev0.map((e) => e.type), ["at", "jat"]);
  const summer = { ...data, timings: { ...data.timings, Asr: "17:20" } };
  assert.deepStrictEqual(S.buildSchedule(summer, on).filter((e) => e.name === "Asr").map((e) => e.type), ["at"]);
  assert.deepStrictEqual(S.buildSchedule(data, { ...on, jamaatEnabled: false }).filter((e) => e.name === "Dhuhr").map((e) => e.type), ["at"]);
});

test("a prayer switched off gives no start and no Jamaat reminder", () => {
  const ev = S.buildSchedule(data, { ...on, perPrayer: { Dhuhr: false } });
  assert.strictEqual(ev.some((e) => e.name === "Dhuhr"), false);
});

test("due events: fire once, ignore old ones (grace)", () => {
  const ev = S.buildSchedule(data, on);
  const jat = ev.find((e) => e.key === "2026-10-07:Dhuhr:jat");
  assert.strictEqual(S.dueEvents(ev, jat.fireAt + 1000, new Set()).filter((e) => e.key === jat.key).length, 1);
  assert.strictEqual(S.dueEvents(ev, jat.fireAt + 1000, new Set([jat.key])).filter((e) => e.key === jat.key).length, 0);
  assert.strictEqual(S.dueEvents(ev, jat.fireAt + 10 * 60000, new Set()).length, 0);
});

test("local date in a time zone, incl. just after midnight", () => {
  const p = S.localParts(Date.UTC(2026, 9, 6, 19, 5), TZ); // 00:05 on 7 Oct in Karachi
  assert.deepStrictEqual(p, { dateISO: "2026-10-07", hour: 0, minute: 5 });
  assert.strictEqual(S.addDaysISO("2026-10-01", -1), "2026-09-30");
  assert.strictEqual(S.isoToDMY("2026-10-07"), "07-10-2026");
  assert.strictEqual(S.isValidTimeZone("Asia/Karachi"), true);
  assert.strictEqual(S.isValidTimeZone("Mars/Base"), false);
});

// ---------- server push: which reminders are due for a device ----------

const sub = { endpoint: "https://push.example/abc", keys: { p256dh: "k", auth: "a" }, timezone: TZ, latitude: 31.5, longitude: 74.3, sentKeys: [] };
const fetchTimes = async () => data;

test("push: nothing is due before the time; the reminder is due right at Jamaat time", async () => {
  const early = await push.dueForSubscription({ sub, settings: on, now: at("2026-10-07", "13:00"), fetchTimes });
  assert.strictEqual(early.length, 0);
  const due = await push.dueForSubscription({ sub, settings: on, now: at("2026-10-07", "13:30") + 5000, fetchTimes });
  assert.deepStrictEqual(due.map((e) => e.key), ["2026-10-07:Dhuhr:jat"]);
});

test("push: already sent keys are skipped; reminders OFF or no place = nothing", async () => {
  const now = at("2026-10-07", "13:30") + 5000;
  assert.strictEqual((await push.dueForSubscription({ sub: { ...sub, sentKeys: ["2026-10-07:Dhuhr:jat"] }, settings: on, now, fetchTimes })).length, 0);
  assert.strictEqual((await push.dueForSubscription({ sub, settings: { notificationsEnabled: false }, now, fetchTimes })).length, 0);
  assert.strictEqual((await push.dueForSubscription({ sub: { ...sub, latitude: null, longitude: null }, settings: on, now, fetchTimes })).length, 0);
});

test("push: the place, method, school and manual adjustment are sent to the prayer API", async () => {
  let seen;
  await push.dueForSubscription({
    sub, settings: { ...on, method: 1, school: 1, adjust: { Asr: 2 } }, now: at("2026-10-07", "10:00"),
    fetchTimes: async (o) => { seen = o; return data; },
  });
  assert.strictEqual(seen.latitude, 31.5);
  assert.strictEqual(seen.method, 1);
  assert.strictEqual(seen.school, 1);
  assert.strictEqual(seen.date, "07-10-2026");
  assert.strictEqual(seen.tune, "0,0,0,0,2,0,0,0,0");
  // a city place
  await push.dueForSubscription({ sub: { ...sub, latitude: null, longitude: null, city: "Lahore", country: "Pakistan" }, settings: on, now: at("2026-10-07", "10:00"), fetchTimes: async (o) => { seen = o; return data; } });
  assert.strictEqual(seen.city, "Lahore");
});

test("push: just after midnight also looks at yesterday's late reminders", async () => {
  const dates = [];
  await push.dueForSubscription({ sub, settings: on, now: at("2026-10-07", "00:02"), fetchTimes: async (o) => { dates.push(o.date); return data; } });
  assert.deepStrictEqual(dates, ["07-10-2026", "06-10-2026"]);
});

test("push: processSubscription sends once, skips a key someone else claimed, drops a gone device", async () => {
  const now = at("2026-10-07", "13:30") + 5000;
  const sent = [];
  const claimed = new Set();
  const deps = {
    fetchTimes,
    claim: async (k) => { if (claimed.has(k)) return false; claimed.add(k); return true; },
    send: async (p) => { sent.push(p); },
    onGone: async () => { throw new Error("should not be called"); },
  };
  assert.strictEqual(await push.processSubscription({ sub, settings: on, now, deps }), 1);
  assert.strictEqual(await push.processSubscription({ sub, settings: on, now, deps }), 0); // already claimed
  assert.strictEqual(sent.length, 1);
  assert.strictEqual(sent[0].title, "SIRAJ • Dhuhr Jamaat");
  assert.strictEqual(sent[0].tag, "siraj-2026-10-07:Dhuhr:jat");
  assert.strictEqual(sent[0].url, "/prayer");

  let gone = 0;
  const err = Object.assign(new Error("gone"), { statusCode: 410 });
  const n = await push.processSubscription({ sub, settings: on, now, deps: { ...deps, claim: async () => true, send: async () => { throw err; }, onGone: async () => { gone++; } } });
  assert.strictEqual(n, 0);
  assert.strictEqual(gone, 1);
});

test("push: VAPID config needs both keys; without them push is simply off", () => {
  assert.strictEqual(push.vapidConfig({}), null);
  assert.strictEqual(push.vapidConfig({ VAPID_PUBLIC_KEY: "x" }), null);
  const cfg = push.vapidConfig({ VAPID_PUBLIC_KEY: "pub", VAPID_PRIVATE_KEY: "priv" });
  assert.strictEqual(cfg.publicKey, "pub");
  assert.match(cfg.subject, /^mailto:/);
  assert.strictEqual(push.pushEnabled({}), false);
});

test("VAPID key generator makes browser-valid keys (65-byte public, 32-byte private, URL-safe)", () => {
  const { publicKey, privateKey } = makeVapidKeys();
  assert.match(publicKey, /^[A-Za-z0-9_-]+$/);
  assert.match(privateKey, /^[A-Za-z0-9_-]+$/);
  assert.strictEqual(Buffer.from(publicKey, "base64url").length, 65);
  assert.strictEqual(Buffer.from(publicKey, "base64url")[0], 4); // uncompressed point
  assert.strictEqual(Buffer.from(privateKey, "base64url").length, 32);
});

test("env check: one VAPID key alone only warns", () => {
  const base = { MONGO_URI: "m", JWT_ACCESS_SECRET: "a".repeat(40), JWT_REFRESH_SECRET: "b".repeat(40) };
  assert.strictEqual(checkEnv({ ...base }).warnings.some((w) => /VAPID/.test(w)), false);
  assert.strictEqual(checkEnv({ ...base, VAPID_PUBLIC_KEY: "x" }).warnings.some((w) => /VAPID/.test(w)), true);
  assert.strictEqual(checkEnv({ ...base, VAPID_PUBLIC_KEY: "x", VAPID_PRIVATE_KEY: "y" }).warnings.some((w) => /VAPID/.test(w)), false);
});

// ---------- validation ----------

const code = (fn) => { try { fn(); return null; } catch (e) { return e.statusCode; } };
const goodBody = { subscription: { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: { p256dh: "p", auth: "a" } }, timezone: TZ, latitude: 31.5, longitude: 74.3 };

test("subscription body: valid, city fallback, and bad input is a 400", () => {
  const d = buildSubscriptionDoc(goodBody, "UA");
  assert.strictEqual(d.latitude, 31.5);
  assert.strictEqual(d.timezone, TZ);
  const c = buildSubscriptionDoc({ ...goodBody, latitude: undefined, longitude: undefined, city: " Lahore ", country: "Pakistan" });
  assert.strictEqual(c.city, "Lahore");
  assert.strictEqual(code(() => buildSubscriptionDoc({})), 400);
  assert.strictEqual(code(() => buildSubscriptionDoc({ ...goodBody, subscription: { ...goodBody.subscription, endpoint: "http://insecure" } })), 400);
  assert.strictEqual(code(() => buildSubscriptionDoc({ ...goodBody, subscription: { endpoint: goodBody.subscription.endpoint, keys: {} } })), 400);
  assert.strictEqual(code(() => buildSubscriptionDoc({ ...goodBody, timezone: "Nowhere/Land" })), 400);
  assert.strictEqual(code(() => buildSubscriptionDoc({ ...goodBody, latitude: 999 })), 400);
  assert.strictEqual(code(() => buildSubscriptionDoc({ subscription: goodBody.subscription, timezone: TZ })), 400); // no place
});

test("cron secret: exact match only, and never when no secret is set", () => {
  assert.strictEqual(secretMatches("abc123", "abc123"), true);
  assert.strictEqual(secretMatches("abc124", "abc123"), false);
  assert.strictEqual(secretMatches("abc", "abc123"), false);
  assert.strictEqual(secretMatches(undefined, "abc123"), false);
  assert.strictEqual(secretMatches("abc123", ""), false);
});

test("settings update: Jamaat fields are validated", () => {
  const u = buildSettingsUpdate({ jamaatEnabled: true, jamaatBefore: 15, jamaatMode: { Dhuhr: "fixed", Fajr: "off" }, jamaatTime: { Dhuhr: "13:30", Asr: "" }, jamaatOffset: { Maghrib: 5 } });
  assert.strictEqual(u.jamaatBefore, 15);
  assert.strictEqual(u["jamaatMode.Dhuhr"], "fixed");
  assert.strictEqual(u["jamaatTime.Dhuhr"], "13:30");
  assert.strictEqual(u["jamaatTime.Asr"], "");
  assert.strictEqual(u["jamaatOffset.Maghrib"], 5);
  assert.strictEqual(code(() => buildSettingsUpdate({ jamaatMode: { Dhuhr: "sometimes" } })), 400);
  assert.strictEqual(code(() => buildSettingsUpdate({ jamaatTime: { Dhuhr: "1:30 PM" } })), 400);
  assert.strictEqual(code(() => buildSettingsUpdate({ jamaatTime: { Dhuhr: "24:00" } })), 400);
  assert.strictEqual(code(() => buildSettingsUpdate({ jamaatOffset: { Asr: 999 } })), 400);
  assert.strictEqual(code(() => buildSettingsUpdate({ jamaatBefore: 90 })), 400);
});

// ---------- the frontend copy of the logic must give the same answers ----------

test("frontend prayerSchedule.js is the same logic as the backend copy", async () => {
  const F = await import("../../frontend/src/utils/prayerSchedule.js");
  const a = S.buildSchedule(data, on).map((e) => [e.key, e.fireAt, e.body]);
  const b = F.buildSchedule(data, on).map((e) => [e.key, e.fireAt, e.body]);
  assert.deepStrictEqual(b, a);
  assert.deepStrictEqual(F.DEFAULT_PRAYER_SETTINGS, S.DEFAULT_PRAYER_SETTINGS);
});

// ---------- files that make it work ----------

test("route files: push routes need a login; cron route uses its own secret", () => {
  const strip = (f) => fs.readFileSync(path.join(__dirname, "..", "routes", f), "utf8").replace(/\/\/.*$/gm, "");
  for (const l of strip("prayerRoutes.js").split("\n").filter((x) => /\/push\//.test(x) && /router\.(get|post)\(/.test(x))) {
    assert.match(l, /requireAuth/, l.trim());
  }
  const cron = strip("cronRoutes.js");
  assert.match(cron, /cronLimiter/);
  assert.ok(/prayer-tick/.test(cron));
});

test("service worker handles push and the version was bumped", () => {
  const sw = fs.readFileSync(path.join(__dirname, "..", "..", "frontend", "public", "sw.js"), "utf8");
  assert.match(sw, /addEventListener\("push"/);
  assert.match(sw, /showNotification/);
  assert.match(sw, /siraj-v19/);
});

test("package.json has web-push and the vapid script; render.yaml lists the keys", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));
  assert.ok(pkg.dependencies["web-push"]);
  assert.ok(pkg.scripts.vapid);
  const render = fs.readFileSync(path.join(__dirname, "..", "..", "render.yaml"), "utf8");
  for (const k of ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "CRON_SECRET"]) assert.ok(render.includes(k), k);
});
