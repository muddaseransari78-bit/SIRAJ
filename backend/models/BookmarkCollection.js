const mongoose = require("mongoose");

// A named folder for bookmarks, e.g. "Favorite Ayahs", "Study".
// "General" always exists implicitly and is not stored here.
const bookmarkCollectionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true, maxlength: 40 },
  },
  { timestamps: true }
);

bookmarkCollectionSchema.index({ user: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("BookmarkCollection", bookmarkCollectionSchema);
