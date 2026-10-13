const mongoose = require("mongoose");

// One document per user per day that the user marked as a fasting day.
// hijriMonth 9 = Ramadan. The Hijri numbers come from the prayer-times API response.
const fastingLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: String, required: true }, // YYYY-MM-DD (user's local day)
    hijriYear: { type: Number, required: true },
    hijriMonth: { type: Number, required: true, min: 1, max: 12 },
    hijriDay: { type: Number, required: true, min: 1, max: 30 },
  },
  { timestamps: true }
);

fastingLogSchema.index({ user: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("FastingLog", fastingLogSchema);
