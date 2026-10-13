const mongoose = require("mongoose");

const GOAL_TYPES = ["TASBEEH_DAILY", "PRAYERS_DAILY", "READING_DAYS_WEEKLY"];

// One goal per type per user. Progress is calculated from real data
// (Tasbeeh sessions, prayer log, reading activity) - it is never typed in by hand.
const goalSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: GOAL_TYPES, required: true },
    target: { type: Number, required: true, min: 1, max: 100000 },
  },
  { timestamps: true }
);

goalSchema.index({ user: 1, type: 1 }, { unique: true });

module.exports = mongoose.model("Goal", goalSchema);
module.exports.GOAL_TYPES = GOAL_TYPES;
