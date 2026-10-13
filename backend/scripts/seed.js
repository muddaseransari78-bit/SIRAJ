/**
 * Creates a SUPER_ADMIN account so you can log in as admin later.
 * Usage:  npm run seed
 * Change the email/password below (or set SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD in .env).
 */
require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const UserPreferences = require("../models/UserPreferences");

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const email = (process.env.SEED_ADMIN_EMAIL || "admin@siraj.local").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD || "ChangeMe12345";

  // Never create a SUPER_ADMIN with the well-known default password on a live server.
  if (process.env.NODE_ENV === "production" && !process.env.SEED_ADMIN_PASSWORD) {
    console.error("Refusing to seed: set SEED_ADMIN_PASSWORD in .env first (production must not use the default password).");
    process.exit(1);
  }

  let user = await User.findOne({ email });
  if (user) {
    console.log(`Admin already exists: ${email}`);
  } else {
    user = await User.create({
      name: "SIRAJ Admin",
      email,
      passwordHash: await bcrypt.hash(password, 12),
      role: "SUPER_ADMIN",
    });
    await UserPreferences.create({ user: user._id });
    console.log(`Created SUPER_ADMIN -> email: ${email}`);
    if (!process.env.SEED_ADMIN_PASSWORD) console.log("Password: ChangeMe12345 (default - change it right after your first login!)");
  }
  await mongoose.disconnect();
})();
