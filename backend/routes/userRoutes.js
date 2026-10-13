const express = require("express");
const rateLimit = require("express-rate-limit");
const ctl = require("../controllers/userController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

// Slow down password-guessing on the change-password form
const passwordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: "Too many attempts. Please try again later." },
});

router.get("/preferences", ctl.getPreferences);
router.put("/preferences", ctl.updatePreferences);
router.patch("/profile", ctl.updateProfile);
router.post("/change-password", passwordLimiter, ctl.changePassword);

module.exports = router;
