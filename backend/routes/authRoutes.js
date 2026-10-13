const express = require("express");
const rateLimit = require("express-rate-limit");
const authController = require("../controllers/authController");
const { registerSchema, loginSchema, socialSchema, validate } = require("../validators/authValidator");
const { requireAuth } = require("../middleware/auth");
const { refreshLimiter } = require("../middleware/rateLimiters");

const router = express.Router();

// Prevent brute-force login attempts
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: "Too many attempts. Please try again later." },
});

router.post("/register", authLimiter, validate(registerSchema), authController.register);
router.post("/login", authLimiter, validate(loginSchema), authController.login);
router.post("/google", authLimiter, validate(socialSchema), authController.google);
router.post("/apple", authLimiter, validate(socialSchema), authController.apple);
router.get("/providers", authController.providers);
router.post("/refresh", refreshLimiter, authController.refresh);
router.post("/logout", authController.logout);
router.get("/me", requireAuth, authController.getMe);

module.exports = router;
