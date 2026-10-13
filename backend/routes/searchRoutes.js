const express = require("express");
const rateLimit = require("express-rate-limit");
const c = require("../controllers/searchController");

const router = express.Router();

// Full search touches several external sources, so it gets a tighter limit than the suggestions.
const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many searches. Please wait a minute." },
});
const suggestLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests. Please slow down." },
});

router.get("/suggest", suggestLimiter, c.suggest);
router.get("/", searchLimiter, c.globalSearch);

module.exports = router;
