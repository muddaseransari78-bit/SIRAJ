// Phase 31 - prayer / Jamaat reminders pushed from the SERVER (Web Push), so they arrive even when
// the browser tab is closed or minimized.
//
// How it works:
//   1. The browser subscribes (frontend/src/services/webPush.js) and sends its push address + place + time zone.
//   2. Every 30 seconds the server "ticks": for each user with reminders ON it takes the prayer times of the
//      user's place (AlAdhan, cached), builds today's reminder events (utils/prayerSchedule.js) and sends the ones
//      that are due right now. Each reminder is sent once per device (sentKeys).
//   3. The service worker (frontend/public/sw.js) shows the notification.
//
// The models, web-push and the prayer API are loaded lazily / injected, so the pure parts can be unit-tested.

const {
  withDefaults, tuneFromSettings, localParts, isoToDMY, addDaysISO, buildSchedule, dueEvents,
} = require("../utils/prayerSchedule");

const GRACE_MS = (Number(process.env.PUSH_GRACE_MINUTES) || 4) * 60 * 1000; // late (sleeping host) reminders still go out
const TICK_MS = 30 * 1000;

// ---------- VAPID / web-push ----------

/** { publicKey, privateKey, subject } when all VAPID values are set, otherwise null (push is simply switched off). */
function vapidConfig(env = process.env) {
  const publicKey = (env.VAPID_PUBLIC_KEY || "").trim();
  const privateKey = (env.VAPID_PRIVATE_KEY || "").trim();
  if (!publicKey || !privateKey) return null;
  const subject = (env.VAPID_SUBJECT || "").trim() || "mailto:admin@siraj.local";
  return { publicKey, privateKey, subject };
}

let webpushModule;
function getWebPush(env = process.env) {
  const cfg = vapidConfig(env);
  if (!cfg) return null;
  if (webpushModule === undefined) {
    try {
      webpushModule = require("web-push");
      webpushModule.setVapidDetails(cfg.subject, cfg.publicKey, cfg.privateKey);
    } catch (e) {
      console.warn(`[SIRAJ] Push is off: ${e.message}. Run "npm install" in backend and check the VAPID keys.`);
      webpushModule = null;
    }
  }
  return webpushModule;
}

function pushEnabled(env = process.env) {
  return !!vapidConfig(env) && !!getWebPush(env);
}

// ---------- pure parts ----------

/** The small JSON the service worker receives. */
function payloadFor(event) {
  return {
    title: event.title,
    body: event.body,
    tag: `siraj-${event.key}`, // same tag as the in-page reminder, so one prayer never shows twice
    url: "/prayer",
    kind: event.type,
  };
}

function placeOf(sub) {
  if (Number.isFinite(sub.latitude) && Number.isFinite(sub.longitude) && sub.latitude !== null && sub.longitude !== null) {
    return { latitude: sub.latitude, longitude: sub.longitude };
  }
  if (sub.city && sub.country) return { city: sub.city, country: sub.country };
  return null;
}

/**
 * Which reminders of ONE device are due right now?
 * deps.fetchTimes({ ...place, method, school, date: "DD-MM-YYYY", tune }) -> the same object as GET /prayer/times.
 */
async function dueForSubscription({ sub, settings: rawSettings, now, fetchTimes, graceMs = GRACE_MS }) {
  const settings = withDefaults(rawSettings);
  if (!settings.notificationsEnabled) return [];
  const place = placeOf(sub);
  if (!place) return [];

  const local = localParts(now, sub.timezone || "UTC");
  const dates = [local.dateISO];
  // Just after midnight a late reminder of the previous evening may still be due (sleeping host)
  if (local.hour === 0 && local.minute < Math.max(10, Math.ceil(graceMs / 60000))) dates.push(addDaysISO(local.dateISO, -1));

  const tune = tuneFromSettings(settings);
  let events = [];
  for (const iso of dates) {
    const data = await fetchTimes({
      ...place, method: settings.method, school: settings.school, date: isoToDMY(iso), tune: tune || undefined,
    });
    events = events.concat(buildSchedule(data, settings));
  }
  return dueEvents(events, now, new Set(sub.sentKeys || []), graceMs);
}

/**
 * Sends the due reminders of one device. deps: { fetchTimes, claim(key)->bool, send(payload)->Promise, onGone() }
 * claim() must be atomic (only ONE caller gets true for a key) - that is what prevents double notifications.
 * Returns the number of pushes sent.
 */
async function processSubscription({ sub, settings, now, deps }) {
  const due = await dueForSubscription({ sub, settings, now, fetchTimes: deps.fetchTimes });
  let sent = 0;
  for (const event of due) {
    if (!(await deps.claim(event.key))) continue; // another tick / server copy already sent it
    try {
      await deps.send(payloadFor(event));
      sent++;
    } catch (e) {
      if (e && (e.statusCode === 404 || e.statusCode === 410)) { await deps.onGone(); break; } // browser unsubscribed
      console.warn(`[SIRAJ] Push failed (${e && e.statusCode ? e.statusCode : e && e.message}).`);
    }
  }
  return sent;
}

// ---------- database parts ----------

const toWebPushSub = (sub) => ({ endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } });

/** One pass over every user with reminders ON. Safe to call often (each reminder is claimed once). */
async function runTick({ now = Date.now() } = {}) {
  const wp = getWebPush();
  if (!wp) return { enabled: false, users: 0, devices: 0, sent: 0 };

  const PrayerSettings = require("../models/PrayerSettings");
  const PushSubscription = require("../models/PushSubscription");
  const prayerApi = require("./external/prayerApi");

  const settingsDocs = await PrayerSettings.find({ notificationsEnabled: true }).lean();
  if (!settingsDocs.length) return { enabled: true, users: 0, devices: 0, sent: 0 };
  const byUser = new Map(settingsDocs.map((s) => [String(s.user), s]));
  const subs = await PushSubscription.find({ user: { $in: [...byUser.keys()] } }).lean();

  let sent = 0;
  for (const sub of subs) {
    const settings = byUser.get(String(sub.user));
    try {
      sent += await processSubscription({
        sub, settings, now,
        deps: {
          fetchTimes: (opts) => prayerApi.getPrayerTimes(opts),
          claim: async (key) => {
            const r = await PushSubscription.updateOne(
              { _id: sub._id, sentKeys: { $ne: key } },
              { $push: { sentKeys: { $each: [key], $slice: -60 } }, $set: { lastSentAt: new Date(now) } }
            );
            return r.modifiedCount === 1;
          },
          send: (payload) => wp.sendNotification(toWebPushSub(sub), JSON.stringify(payload), { TTL: 600, urgency: "high" }),
          onGone: () => PushSubscription.deleteOne({ _id: sub._id }),
        },
      });
    } catch (e) {
      console.warn(`[SIRAJ] Push tick skipped a device: ${e && e.message}`);
    }
  }
  return { enabled: true, users: byUser.size, devices: subs.length, sent };
}

/** Test push to every device of one user. */
async function sendTestPush(userId) {
  const wp = getWebPush();
  if (!wp) return { enabled: false, devices: 0, sent: 0 };
  const PushSubscription = require("../models/PushSubscription");
  const subs = await PushSubscription.find({ user: userId });
  let sent = 0;
  for (const sub of subs) {
    try {
      await wp.sendNotification(
        toWebPushSub(sub),
        JSON.stringify({ title: "SIRAJ • Test", body: "Background reminders work on this device, even when SIRAJ is closed.", tag: "siraj-test", url: "/prayer", kind: "test" }),
        { TTL: 120, urgency: "high" }
      );
      sent++;
    } catch (e) {
      if (e && (e.statusCode === 404 || e.statusCode === 410)) await PushSubscription.deleteOne({ _id: sub._id });
    }
  }
  return { enabled: true, devices: subs.length, sent };
}

/** Starts the 30-second timer. Returns a stop() function. Does nothing when push is not configured. */
function startScheduler({ intervalMs = TICK_MS, log = console.log } = {}) {
  if (process.env.PUSH_SCHEDULER === "off") { log("[SIRAJ] Push scheduler is off (PUSH_SCHEDULER=off)."); return () => {}; }
  if (!pushEnabled()) { log("[SIRAJ] Push reminders are not set up (no VAPID keys) - see DEPLOYMENT.md section 8."); return () => {}; }
  let running = false;
  const timer = setInterval(async () => {
    if (running) return; // never two ticks at once
    running = true;
    try { await runTick(); } catch (e) { console.warn(`[SIRAJ] Push tick failed: ${e && e.message}`); } finally { running = false; }
  }, intervalMs);
  if (timer.unref) timer.unref();
  log(`[SIRAJ] Push scheduler running (every ${Math.round(intervalMs / 1000)}s).`);
  return () => clearInterval(timer);
}

module.exports = {
  vapidConfig, pushEnabled, payloadFor, placeOf, dueForSubscription, processSubscription,
  runTick, sendTestPush, startScheduler, GRACE_MS,
};
