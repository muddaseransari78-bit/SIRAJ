const mongoose = require("mongoose");

// Phase 31 - one browser/device that agreed to get prayer reminders even when SIRAJ is closed (Web Push).
// The server keeps the browser's push address + keys, the place (for prayer times) and the time zone.
// The reminder SETTINGS themselves stay in PrayerSettings (one place), so changing a setting works at once.
const pushSubscriptionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    endpoint: { type: String, required: true, unique: true, maxlength: 1000 }, // the browser's own push address
    keys: {
      p256dh: { type: String, required: true, maxlength: 300 },
      auth: { type: String, required: true, maxlength: 100 },
    },
    timezone: { type: String, required: true, maxlength: 64 }, // e.g. "Asia/Karachi" (from the browser)
    // Where this device is: coordinates OR a manual city + country
    latitude: { type: Number, min: -90, max: 90, default: null },
    longitude: { type: Number, min: -180, max: 180, default: null },
    city: { type: String, maxlength: 80, default: "" },
    country: { type: String, maxlength: 80, default: "" },
    userAgent: { type: String, maxlength: 200, default: "" },
    // Reminder keys already sent to this device (keeps each reminder to ONE push, even with two server copies)
    sentKeys: { type: [String], default: [] },
    lastSentAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PushSubscription", pushSubscriptionSchema);
