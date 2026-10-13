const mongoose = require("mongoose");

const bookmarkSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ["AYAH", "SURAH", "HADITH", "DUA"],
      required: true,
    },
    // For an Ayah bookmark
    surahNumber: { type: Number },
    ayahNumber: { type: Number },
    // For a Hadith bookmark
    hadithBook: { type: String },
    hadithNumber: { type: String },
    // For a Dua bookmark
    duaId: { type: mongoose.Schema.Types.ObjectId, ref: "Dua" },
    // Reference of the saved Dua (e.g. its slug/number from the Duas API)
    duaRef: { type: String },
    // Which collection (folder) this bookmark is in. "General" = default.
    collectionName: {
      type: String,
      default: "General",
      maxlength: 40,
    },
  },
  { timestamps: true }
);

bookmarkSchema.index({ user: 1, type: 1, surahNumber: 1, ayahNumber: 1 });

module.exports = mongoose.model("Bookmark", bookmarkSchema);
