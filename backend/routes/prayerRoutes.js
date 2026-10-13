const express = require("express");
const prayerController = require("../controllers/prayerController");
const userCtl = require("../controllers/prayerUserController");
const pushCtl = require("../controllers/pushController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// Public
router.get("/times", prayerController.getTimes);

// Logged-in only
router.get("/settings", requireAuth, userCtl.getSettings);
router.put("/settings", requireAuth, userCtl.updateSettings);
router.get("/log", requireAuth, userCtl.getLogs);
router.post("/log", requireAuth, userCtl.setLog);
router.get("/stats", requireAuth, userCtl.getStats);

// Phase 31 - background reminders (Web Push). All need a login.
router.get("/push/key", requireAuth, pushCtl.getKey);
router.get("/push/status", requireAuth, pushCtl.status);
router.post("/push/subscribe", requireAuth, pushCtl.subscribe);
router.post("/push/unsubscribe", requireAuth, pushCtl.unsubscribe);
router.post("/push/test", requireAuth, pushCtl.sendTest);

module.exports = router;
