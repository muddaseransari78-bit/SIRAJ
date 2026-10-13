const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: 80,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      default: null, // empty for people who only use Google / Apple sign-in
      select: false, // never returned by default queries
    },
    // Google / Apple sign-in (the provider's own id for this person)
    googleId: { type: String, default: undefined },
    appleId: { type: String, default: undefined },
    authProvider: { type: String, enum: ["email", "google", "apple"], default: "email" },
    role: {
      type: String,
      enum: ["USER", "ADMIN", "SUPER_ADMIN"],
      default: "USER",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    profilePicture: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

userSchema.index({ googleId: 1 }, { unique: true, sparse: true });
userSchema.index({ appleId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("User", userSchema);
