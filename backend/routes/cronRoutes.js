const express = require("express");
const rateLimit = require("express-rate-limit");
const pushCtl = require("../controllers/pushController");

const router = express.Router();

// Phase 31 - for an external timer only. It is protected by the CRON_SECRET from .env (header x-cron-secret)
// and answers 404 when no secret is set. Rate limited so a wrong secret cannot be guessed quickly.
const cronLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests." },
});

router.post("/prayer-tick", cronLimiter, pushCtl.cronTick);
router.get("/prayer-tick", cronLimiter, pushCtl.cronTick);

module.exports = router;
