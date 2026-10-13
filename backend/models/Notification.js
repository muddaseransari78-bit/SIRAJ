const mongoose = require("mongoose");

// In-app notifications (the bell icon). Different from browser prayer reminders.
const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["INFO", "GOAL", "SYSTEM", "ANNOUNCEMENT"], default: "INFO" },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    body: { type: String, default: "", trim: true, maxlength: 500 },
    link: { type: String, default: "", maxlength: 200 }, // in-app path, e.g. /goals
    read: { type: Boolean, default: false },
    // Optional de-duplication key, e.g. "goal:TASBEEH_DAILY:2026-09-30"
    key: { type: String },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, key: 1 }, { unique: true, partialFilterExpression: { key: { $type: "string" } } });

module.exports = mongoose.model("Notification", notificationSchema);
