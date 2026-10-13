const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const UserPreferences = require("../models/UserPreferences");

function createError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function signAccessToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
  });
}

function signRefreshToken(user) {
  return jwt.sign({ id: user._id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "90d",
  });
}

async function registerUser({ name, email, password }) {
  const existing = await User.findOne({ email });
  if (existing) {
    throw createError("An account with this email already exists", 409);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ name, email, passwordHash });

  // Every new user gets a default preferences document
  await UserPreferences.create({ user: user._id });

  return {
    user: sanitizeUser(user),
    accessToken: signAccessToken(user),
    refreshToken: signRefreshToken(user),
  };
}

// A fixed fake hash. When the email does not exist we still run bcrypt against it,
// so "wrong email" and "wrong password" take the same time (stops account guessing by timing).
const DUMMY_HASH = bcrypt.hashSync("siraj-timing-protection", 12);

async function loginUser({ email, password }) {
  const user = await User.findOne({ email }).select("+passwordHash");
  // People who joined with Google / Apple have no password: they still pay the same bcrypt time, then are refused
  const hasPassword = !!(user && user.passwordHash);
  const isMatch = await bcrypt.compare(password, hasPassword ? user.passwordHash : DUMMY_HASH);

  // Same message for "no such email" and "wrong password"
  if (!user || !hasPassword || !isMatch) {
    throw createError("Invalid email or password", 401);
  }

  // Only someone who knows the correct password learns that the account is deactivated
  if (!user.isActive) {
    throw createError("This account has been deactivated", 403);
  }

  return {
    user: sanitizeUser(user),
    accessToken: signAccessToken(user),
    refreshToken: signRefreshToken(user),
  };
}

async function refreshAccessToken(refreshToken) {
  if (!refreshToken) {
    throw createError("No refresh token provided", 401);
  }

  let decoded;
  try {
    decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch (err) {
    throw createError("Invalid or expired refresh token", 401);
  }

  const user = await User.findById(decoded.id);
  if (!user || !user.isActive) {
    throw createError("User no longer exists or is deactivated", 401);
  }

  // The refresh token is renewed on every use ("sliding"): someone who comes back at least once per period stays logged in
  return { accessToken: signAccessToken(user), refreshToken: signRefreshToken(user) };
}

function sanitizeUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    profilePicture: user.profilePicture,
  };
}

module.exports = { registerUser, loginUser, refreshAccessToken, sanitizeUser, signAccessToken, signRefreshToken };
