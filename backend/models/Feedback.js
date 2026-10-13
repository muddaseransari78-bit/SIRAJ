const mongoose = require("mongoose");
const { TYPES, RECOMMEND, FEATURES } = require("../utils/feedbackValidate");

// Phase 30 - feedback from logged-in users about the website.
const feedbackSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: TYPES, default: "general" },
    ratings: {
      overall: { type: Number, min: 1, max: 5, required: true },
      ease: { type: Number, min: 1, max: 5 },
      quran: { type: Number, min: 1, max: 5 },
      audio: { type: Number, min: 1, max: 5 },
    },
    features: [{ type: String, enum: FEATURES }],
    recommend: { type: String, enum: RECOMMEND, required: true },
    improve: { type: String, maxlength: 1000, default: "" },
    newFeature: { type: String, maxlength: 1000, default: "" },
    status: { type: String, enum: ["new", "reviewed"], default: "new" },
  },
  { timestamps: true }
);

feedbackSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Feedback", feedbackSchema);
