const express = require("express");
const rateLimit = require("express-rate-limit");
const c = require("../controllers/feedbackController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// Feedback is only for logged-in users (Phase 30).
router.use(requireAuth);

// Max 5 feedback messages per hour per user, so the form cannot be used to flood the admin panel.
const feedbackLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `fb:${req.user.id}`,
  message: { success: false, message: "You have sent several feedback messages already. Please try again in an hour." },
});

router.post("/", feedbackLimiter, c.submit);
router.get("/mine", c.mine);

module.exports = router;
