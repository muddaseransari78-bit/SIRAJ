const mongoose = require("mongoose");

// One document per user per day on which they read / marked progress.
// Used to calculate the reading streak.
const readingActivitySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: String, required: true }, // "YYYY-MM-DD" (user's local day)
    count: { type: Number, default: 0 }, // how many progress actions that day
  },
  { timestamps: true }
);

readingActivitySchema.index({ user: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("ReadingActivity", readingActivitySchema);
