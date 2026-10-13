const mongoose = require("mongoose");

const PRAYERS = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];

// One small group of fields per prayer, e.g. perPrayer.Fajr, before.Fajr ...
const enabledSchema = {};   // reminder on/off for each prayer
const adhanSchema = {};     // play Adhan for each prayer (only if adhanEnabled is on)
const beforeSchema = {};    // minutes before THIS prayer (null = use the global minutesBefore)
const adjustSchema = {};    // manual correction in minutes (-30..30) added to the calculated time
const messageSchema = {};   // optional custom text shown when it is time for this prayer
// Phase 31 - Jamaat (congregation) time per prayer. It is NOT the start of the prayer time.
const jamaatModeSchema = {};   // "off" | "fixed" (clock time) | "offset" (N minutes after the prayer starts)
const jamaatTimeSchema = {};   // "HH:MM" 24-hour, used when mode = "fixed"
const jamaatOffsetSchema = {}; // minutes after the start, used when mode = "offset"
const JAMAAT_DEFAULTS = {
  // Ahl-e-Sunnat mosque reference: Zuhar Jamaat 1:30 PM, Asr Jamaat 4:30 PM. Edit them on the Prayer page.
  mode: { Fajr: "off", Dhuhr: "fixed", Asr: "fixed", Maghrib: "off", Isha: "off" },
  time: { Fajr: "", Dhuhr: "13:30", Asr: "16:30", Maghrib: "", Isha: "" },
  offset: { Fajr: 20, Dhuhr: 15, Asr: 15, Maghrib: 5, Isha: 15 },
};
PRAYERS.forEach((p) => {
  enabledSchema[p] = { type: Boolean, default: true };
  adhanSchema[p] = { type: Boolean, default: true };
  beforeSchema[p] = { type: Number, min: 0, max: 60, default: null };
  adjustSchema[p] = { type: Number, min: -30, max: 30, default: 0 };
  messageSchema[p] = { type: String, maxlength: 120, default: "" };
  jamaatModeSchema[p] = { type: String, enum: ["off", "fixed", "offset"], default: JAMAAT_DEFAULTS.mode[p] };
  jamaatTimeSchema[p] = { type: String, match: /^$|^([01]\d|2[0-3]):[0-5]\d$/, default: JAMAAT_DEFAULTS.time[p] };
  jamaatOffsetSchema[p] = { type: Number, min: 0, max: 180, default: JAMAAT_DEFAULTS.offset[p] };
});

const prayerSettingsSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    method: { type: Number, default: 1, min: 0, max: 99 },
    school: { type: Number, default: 1, enum: [0, 1] }, // 0 = Shafi/Maliki/Hanbali, 1 = Hanafi (affects Asr). New accounts start with Hanafi.
    notificationsEnabled: { type: Boolean, default: false },
    adhanEnabled: { type: Boolean, default: false },
    minutesBefore: { type: Number, default: 0, min: 0, max: 60 }, // global "remind X minutes before"
    perPrayer: enabledSchema,
    adhanPer: adhanSchema,
    before: beforeSchema,
    adjust: adjustSchema,
    customMessage: messageSchema,
    // Phase 31 - Jamaat
    jamaatEnabled: { type: Boolean, default: true },
    jamaatBefore: { type: Number, default: 10, min: 0, max: 60 }, // reminder N minutes before Jamaat (0 = none)
    jamaatMode: jamaatModeSchema,
    jamaatTime: jamaatTimeSchema,
    jamaatOffset: jamaatOffsetSchema,
    // Manual location fallback (used when the browser location is not allowed)
    city: { type: String, maxlength: 80, default: "" },
    country: { type: String, maxlength: 80, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PrayerSettings", prayerSettingsSchema);
module.exports.PRAYERS = PRAYERS;
