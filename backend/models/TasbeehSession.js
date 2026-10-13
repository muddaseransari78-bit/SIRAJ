const mongoose = require("mongoose");

const tasbeehSessionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    dhikr: { type: String, required: true, maxlength: 100 },
    count: { type: Number, required: true, min: 1 },
    target: { type: Number, default: 33 },
    date: { type: String, required: true }, // YYYY-MM-DD, for daily totals
  },
  { timestamps: true }
);

tasbeehSessionSchema.index({ user: 1, date: 1 });

module.exports = mongoose.model("TasbeehSession", tasbeehSessionSchema);
