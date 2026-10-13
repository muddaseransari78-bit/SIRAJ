const mongoose = require("mongoose");

const userPreferencesSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    language: {
      type: String,
      enum: ["en", "ur", "ar"],
      default: "en",
    },
    theme: {
      type: String,
      enum: ["noor-dark", "noor-soft"],
      default: "noor-dark",
    },
    arabicFontSize: {
      type: Number,
      default: 28,
      min: 16,
      max: 48,
    },
    translationLanguage: {
      type: String,
      default: "en",
    },
    showTransliteration: {
      type: Boolean,
      default: true,
    },
    prayerCalculationMethod: {
      type: String,
      default: "MWL", // Muslim World League - matches AlAdhan API method codes
    },
    madhab: {
      type: String,
      enum: ["Shafi", "Hanafi"],
      default: "Shafi",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("UserPreferences", userPreferencesSchema);
