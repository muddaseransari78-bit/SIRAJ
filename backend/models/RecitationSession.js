const mongoose = require("mongoose");

// One saved Live Recitation practice session. The user presses "Save this session" - nothing is saved automatically.
// Only SCORES are kept: never the audio, never the words the speech recogniser heard.
const ayahResultSchema = new mongoose.Schema(
  {
    ayahNumber: { type: Number, required: true, min: 1, max: 286 },
    score: { type: Number, required: true, min: 0, max: 100 }, // % of words recognised
    problems: { type: Number, required: true, min: 0, max: 400 }, // words to check
  },
  { _id: false }
);

const recitationSessionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    surahNumber: { type: Number, required: true, min: 1, max: 114 },
    date: { type: String, required: true }, // YYYY-MM-DD (user's local day)
    ayahs: { type: [ayahResultSchema], validate: (v) => v.length >= 1 && v.length <= 286 },
    averageScore: { type: Number, required: true, min: 0, max: 100 },
  },
  { timestamps: true }
);

recitationSessionSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("RecitationSession", recitationSessionSchema);
