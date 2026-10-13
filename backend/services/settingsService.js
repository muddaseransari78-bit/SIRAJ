const AppSettings = require("../models/AppSettings");

const DEFAULTS = { registrationEnabled: true, ramadanEnabled: true, siteNotice: "" };
const TTL_MS = 15000; // settings are re-read from the database at most every 15 seconds
let cached = null;
let cachedAt = 0;

function pick(doc) {
  const out = { ...DEFAULTS };
  if (doc) Object.keys(DEFAULTS).forEach((k) => { if (doc[k] !== undefined && doc[k] !== null) out[k] = doc[k]; });
  return out;
}

async function getSettings() {
  if (cached && Date.now() - cachedAt < TTL_MS) return cached;
  try {
    cached = pick(await AppSettings.findOne({ key: "app" }).lean());
    cachedAt = Date.now();
    return cached;
  } catch (e) {
    return cached || { ...DEFAULTS }; // if the database hiccups, keep the website working
  }
}

async function updateSettings(patch, userId) {
  await AppSettings.findOneAndUpdate(
    { key: "app" },
    { $set: { ...patch, updatedBy: userId } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  cached = null;
  return getSettings();
}

module.exports = { getSettings, updateSettings, DEFAULTS, pick };
