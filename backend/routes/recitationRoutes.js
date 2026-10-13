const express = require("express");
const rateLimit = require("express-rate-limit");
const { requireAuth } = require("../middleware/auth");
const { harakatStatus, harakatCheck, harakatLive } = require("../controllers/recitationController");
const sessions = require("../controllers/recitationSessionController");
const { MAX_AUDIO_BYTES } = require("../services/harakatService");

const router = express.Router();

// Every check uses the (paid / slow) pronunciation model, so keep it modest per IP
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 12,
  message: { success: false, message: "Too many checks. Please wait a minute and try again." },
});

// Live checks come every ~1.5 s while someone recites, so they get their own, higher limit
const liveLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 90,
  message: { success: false, message: "Too many live checks. Please wait a moment." },
});

// Reads the body as raw bytes, only for audio uploads (MediaRecorder sends audio/webm, Safari audio/mp4)
const rawAudio = express.raw({ type: ["audio/*", "video/webm"], limit: MAX_AUDIO_BYTES });

router.get("/harakat/status", harakatStatus);
router.post("/harakat", limiter, requireAuth, rawAudio, harakatCheck);
router.post("/harakat/live", liveLimiter, requireAuth, rawAudio, harakatLive);

// Saved practice sessions (scores only - login required)
router.post("/sessions", requireAuth, sessions.createSession);
router.get("/sessions", requireAuth, sessions.listSessions);
router.delete("/sessions/:id", requireAuth, sessions.deleteSession);

module.exports = router;
