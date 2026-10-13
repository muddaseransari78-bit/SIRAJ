const bcrypt = require("bcryptjs");
const User = require("../models/User");
const UserPreferences = require("../models/UserPreferences");
const authService = require("../services/authService");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const { passwordProblems } = require("../utils/passwordPolicy");

function bad(message, code = 400) {
  const err = new Error(message);
  err.statusCode = code;
  return err;
}

const getPreferences = asyncHandler(async (req, res) => {
  let prefs = await UserPreferences.findOne({ user: req.user.id });
  if (!prefs) prefs = await UserPreferences.create({ user: req.user.id });
  return sendSuccess(res, { message: "Preferences", data: { preferences: prefs } });
});

// Only fields we know about are accepted; each is validated.
const updatePreferences = asyncHandler(async (req, res) => {
  const b = req.body || {};
  const update = {};
  if (b.language !== undefined) {
    if (!["en", "ur", "ar"].includes(b.language)) throw bad("Invalid language");
    update.language = b.language;
  }
  if (b.theme !== undefined) {
    if (!["noor-dark", "noor-soft"].includes(b.theme)) throw bad("Invalid theme");
    update.theme = b.theme;
  }
  if (b.arabicFontSize !== undefined) {
    const n = Number(b.arabicFontSize);
    if (!Number.isInteger(n) || n < 16 || n > 48) throw bad("Arabic font size must be 16-48");
    update.arabicFontSize = n;
  }
  if (b.translationLanguage !== undefined) {
    if (!["en", "ur"].includes(b.translationLanguage)) throw bad("Invalid translation language");
    update.translationLanguage = b.translationLanguage;
  }
  if (b.showTransliteration !== undefined) update.showTransliteration = !!b.showTransliteration;
  if (b.madhab !== undefined) {
    if (!["Shafi", "Hanafi"].includes(b.madhab)) throw bad("Invalid madhab");
    update.madhab = b.madhab;
  }
  const prefs = await UserPreferences.findOneAndUpdate(
    { user: req.user.id },
    { $set: update },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return sendSuccess(res, { message: "Preferences saved", data: { preferences: prefs } });
});

const updateProfile = asyncHandler(async (req, res) => {
  const name = String(req.body?.name || "").trim();
  if (name.length < 2 || name.length > 80) throw bad("Name must be 2-80 characters");
  const user = await User.findByIdAndUpdate(req.user.id, { $set: { name } }, { new: true });
  if (!user) throw bad("User not found", 404);
  return sendSuccess(res, { message: "Profile updated", data: { user: authService.sanitizeUser(user) } });
});

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (typeof currentPassword !== "string" || typeof newPassword !== "string") throw bad("Both passwords are required");
  if (currentPassword.length > 128) throw bad("Current password is incorrect", 401);
  const problems = passwordProblems(newPassword);
  if (problems.length) throw bad(problems[0]);
  if (newPassword === currentPassword) throw bad("New password must be different from the current one");

  const user = await User.findById(req.user.id).select("+passwordHash");
  if (!user) throw bad("User not found", 404);
  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) throw bad("Current password is incorrect", 401);

  user.passwordHash = await bcrypt.hash(newPassword, 12);
  await user.save();
  return sendSuccess(res, { message: "Password changed" });
});

module.exports = { getPreferences, updatePreferences, updateProfile, changePassword };
