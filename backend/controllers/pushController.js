// Phase 31 - Web Push endpoints for prayer / Jamaat reminders that work when SIRAJ is closed.
const crypto = require("crypto");
const asyncHandler = require("../utils/asyncHandler");
const httpError = require("../utils/httpError");
const { sendSuccess } = require("../utils/apiResponse");
const { isValidTimeZone } = require("../utils/prayerSchedule");
const push = require("../services/pushService");

const MAX_DEVICES_PER_USER = 5;

// Pure validation: the browser's PushSubscription + where it is -> a safe document (or throws a 400).
function buildSubscriptionDoc(body, userAgent = "") {
  const { subscription, timezone, latitude, longitude, city, country } = body || {};
  if (!subscription || typeof subscription !== "object") throw httpError(400, "subscription is required");
  const endpoint = subscription.endpoint;
  const keys = subscription.keys || {};
  if (typeof endpoint !== "string" || endpoint.length > 1000 || !/^https:\/\//i.test(endpoint)) {
    throw httpError(400, "Invalid push address");
  }
  if (typeof keys.p256dh !== "string" || !keys.p256dh || keys.p256dh.length > 300 ||
      typeof keys.auth !== "string" || !keys.auth || keys.auth.length > 100) {
    throw httpError(400, "Invalid push keys");
  }
  if (!isValidTimeZone(timezone)) throw httpError(400, "A valid time zone is required (for example Asia/Karachi)");

  const doc = { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth }, timezone, latitude: null, longitude: null, city: "", country: "", userAgent: String(userAgent || "").slice(0, 200) };
  const hasCoords = latitude !== undefined && latitude !== null && longitude !== undefined && longitude !== null;
  if (hasCoords) {
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
      throw httpError(400, "lat must be -90..90 and lng must be -180..180");
    }
    doc.latitude = lat;
    doc.longitude = lng;
  } else {
    const c = typeof city === "string" ? city.trim() : "";
    const k = typeof country === "string" ? country.trim() : "";
    if (!c || !k || c.length > 80 || k.length > 80) throw httpError(400, "Send the location (lat and lng) or city and country");
    doc.city = c;
    doc.country = k;
  }
  return doc;
}

/** Constant-time compare for the cron secret. */
function secretMatches(given, expected) {
  if (!expected || typeof given !== "string") return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// The browser needs the PUBLIC key to subscribe. enabled=false -> the server has no VAPID keys / web-push yet.
const getKey = asyncHandler(async (req, res) => {
  const cfg = push.vapidConfig();
  const enabled = push.pushEnabled();
  return sendSuccess(res, { message: "Push key", data: { enabled, publicKey: enabled ? cfg.publicKey : null } });
});

const subscribe = asyncHandler(async (req, res) => {
  if (!push.pushEnabled()) throw httpError(503, "Background reminders are not set up on the server yet.");
  const PushSubscription = require("../models/PushSubscription");
  const doc = buildSubscriptionDoc(req.body, req.headers["user-agent"]);

  const mine = await PushSubscription.countDocuments({ user: req.user.id, endpoint: { $ne: doc.endpoint } });
  if (mine >= MAX_DEVICES_PER_USER) throw httpError(400, `You can use background reminders on up to ${MAX_DEVICES_PER_USER} devices. Turn it off on another device first.`);

  // Upsert by endpoint: the same browser re-sending (new location) just updates the row.
  // An endpoint that belonged to another account (shared browser) moves to the logged-in user.
  await PushSubscription.findOneAndUpdate(
    { endpoint: doc.endpoint },
    { $set: { ...doc, user: req.user.id } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return sendSuccess(res, { message: "Background reminders are on for this device", data: { devices: mine + 1 } });
});

const unsubscribe = asyncHandler(async (req, res) => {
  const PushSubscription = require("../models/PushSubscription");
  const endpoint = req.body && req.body.endpoint;
  if (typeof endpoint !== "string" || !endpoint) throw httpError(400, "endpoint is required");
  await PushSubscription.deleteOne({ endpoint, user: req.user.id });
  return sendSuccess(res, { message: "Background reminders are off for this device" });
});

const status = asyncHandler(async (req, res) => {
  const PushSubscription = require("../models/PushSubscription");
  const endpoint = req.query.endpoint;
  const devices = await PushSubscription.countDocuments({ user: req.user.id });
  const thisDevice = typeof endpoint === "string" && endpoint
    ? (await PushSubscription.countDocuments({ user: req.user.id, endpoint })) > 0
    : false;
  return sendSuccess(res, { message: "Push status", data: { enabled: push.pushEnabled(), devices, thisDevice } });
});

const sendTest = asyncHandler(async (req, res) => {
  if (!push.pushEnabled()) throw httpError(503, "Background reminders are not set up on the server yet.");
  const result = await push.sendTestPush(req.user.id);
  if (!result.devices) throw httpError(404, "No device is registered yet. Turn background reminders on first.");
  return sendSuccess(res, { message: result.sent ? "Test notification sent" : "Could not reach your device", data: result });
});

// Called by an external timer (cron-job.org / UptimeRobot) with the secret. It wakes a sleeping free host
// AND runs one pass, so reminders are not missed. Without CRON_SECRET in .env this route is disabled.
const cronTick = asyncHandler(async (req, res) => {
  const expected = process.env.CRON_SECRET;
  if (!expected) throw httpError(404, "Not found");
  const given = req.get("x-cron-secret") || req.query.secret;
  if (!secretMatches(given, expected)) throw httpError(401, "Invalid secret");
  const result = await push.runTick();
  return sendSuccess(res, { message: "Tick done", data: result });
});

module.exports = { getKey, subscribe, unsubscribe, status, sendTest, cronTick, buildSubscriptionDoc, secretMatches, MAX_DEVICES_PER_USER };
