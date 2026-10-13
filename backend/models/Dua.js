const mongoose = require("mongoose");

// Duas stored in SIRAJ's own database: written by admins, shipped as a starter set, or imported from Hisn al-Muslim.
// A source/reference is REQUIRED so nothing is shown without where it came from.
const duaSchema = new mongoose.Schema(
  {
    category: { type: String, required: true, trim: true, lowercase: true, match: /^[a-z0-9-]{2,40}$/ },
    title: { type: String, trim: true, maxlength: 120, default: "" },
    arabic: { type: String, required: true, trim: true, maxlength: 2000 },
    transliteration: { type: String, trim: true, maxlength: 2000, default: "" },
    urdu: { type: String, trim: true, maxlength: 2000, default: "" },
    // true when the Urdu was made by the translation service (not typed by a person): the card then shows a "check it" note
    urduMachine: { type: Boolean, default: false },
    english: { type: String, trim: true, maxlength: 2000, default: "" },
    source: { type: String, required: true, trim: true, maxlength: 300 },
    isActive: { type: Boolean, default: true },
    // Where this row came from: "admin" (typed in the admin panel), "starter" (Quran verses shipped with SIRAJ),
    // "import" (copied from the Hisn al-Muslim API by `npm run import-duas`).
    origin: { type: String, enum: ["admin", "starter", "import"], default: "admin" },
    // Only for starter/import rows: stops the same Dua being added twice, and keeps old bookmarks working.
    externalKey: { type: String, trim: true, maxlength: 200 },
    externalSlug: { type: String, trim: true, maxlength: 100 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

duaSchema.index({ category: 1, isActive: 1 });
duaSchema.index({ externalKey: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("Dua", duaSchema);
