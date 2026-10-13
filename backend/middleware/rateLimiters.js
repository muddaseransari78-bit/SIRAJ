const rateLimit = require("express-rate-limit");

// One place for the general limits (Phase 20 - security). Login/register/search/etc. keep their own stricter
// limiters inside their route files; these two are the safety net for everything else.
// Numbers can be changed in .env without touching code.
const num = (name, fallback) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const message = (text) => ({ success: false, message: text });

// Every /api request: 300 per minute per visitor by default (normal use stays far below this).
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: num("RATE_LIMIT_API_MAX", 300),
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === "OPTIONS" || req.path === "/health",
  message: message("Too many requests. Please slow down and try again in a minute."),
});

// Token refresh happens on page loads, so allow more than login but still stop abuse.
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: num("RATE_LIMIT_REFRESH_MAX", 120),
  standardHeaders: true,
  legacyHeaders: false,
  message: message("Too many session refreshes. Please try again later."),
});

module.exports = { apiLimiter, refreshLimiter };
