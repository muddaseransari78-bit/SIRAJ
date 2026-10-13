const mongoose = require("mongoose");

// Short daily reminders chosen by admins. One of the active ones is shown on Home each day.
const reminderSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true, maxlength: 400 },
    source: { type: String, required: true, trim: true, maxlength: 300 },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Reminder", reminderSchema);
