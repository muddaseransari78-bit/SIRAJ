const mongoose = require("mongoose");

const readingProgressSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    lastSurahNumber: { type: Number, default: 1 },
    lastAyahNumber: { type: Number, default: 1 },
    surahsCompleted: [{ type: Number }], // list of surah numbers marked complete
    juzCompleted: [{ type: Number }], // list of juz numbers (1-30) marked complete
    khatmCount: { type: Number, default: 0 }, // how many times the user finished a full Khatm
    readingStreakDays: { type: Number, default: 0 },
    lastReadAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ReadingProgress", readingProgressSchema);
