const mongoose = require("mongoose");

const noteSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    surahNumber: { type: Number, required: true },
    ayahNumber: { type: Number, required: true },
    text: {
      type: String,
      required: true,
      maxlength: 2000,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Note", noteSchema);
