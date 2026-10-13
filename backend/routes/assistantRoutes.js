const express = require("express");
const rateLimit = require("express-rate-limit");
const { ask } = require("../controllers/assistantController");

const router = express.Router();

// Each question triggers several external searches, so keep it modest per IP
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { success: false, message: "Too many questions. Please wait a minute and try again." },
});

router.post("/ask", limiter, ask);

module.exports = router;
