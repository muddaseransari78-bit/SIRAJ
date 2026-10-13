const mongoose = require("mongoose");

// One document per user per day per prayer (self-logged completion).
const prayerLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: String, required: true }, // YYYY-MM-DD
    prayer: { type: String, enum: ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"], required: true },
    completed: { type: Boolean, default: true },
  },
  { timestamps: true }
);

prayerLogSchema.index({ user: 1, date: 1, prayer: 1 }, { unique: true });

module.exports = mongoose.model("PrayerLog", prayerLogSchema);
