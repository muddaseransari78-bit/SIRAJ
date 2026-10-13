const express = require("express");
const mongoose = require("mongoose");

const authRoutes = require("./authRoutes");
const quranRoutes = require("./quranRoutes");
const bookmarkRoutes = require("./bookmarkRoutes");
const noteRoutes = require("./noteRoutes");
const progressRoutes = require("./progressRoutes");
const prayerRoutes = require("./prayerRoutes");
const hadithRoutes = require("./hadithRoutes");
const tasbeehRoutes = require("./tasbeehRoutes");
const { duaRouter, qiblaRouter } = require("./duaQiblaRoutes");
const { tafseerRouter, calendarRouter, announcementRouter, reminderRouter } = require("./contentRoutes");
const searchRoutes = require("./searchRoutes");
const adminRoutes = require("./adminRoutes");
const ramadanRoutes = require("./ramadanRoutes");
const goalRoutes = require("./goalRoutes");
const notificationRoutes = require("./notificationRoutes");
const userRoutes = require("./userRoutes");
const assistantRoutes = require("./assistantRoutes");
const recitationRoutes = require("./recitationRoutes");
const dashboardRoutes = require("./dashboardRoutes");
const settingsRoutes = require("./settingsRoutes");
const feedbackRoutes = require("./feedbackRoutes");
const cronRoutes = require("./cronRoutes");
const { publicCache } = require("../middleware/cachePolicy");

const router = express.Router();

// Public religious content may be cached for 1 hour (guests only - see middleware/cachePolicy.js).
// Everything else keeps the "no-store" default that app.js sets for the whole API.
const CONTENT_CACHE_SECONDS = 60 * 60;

router.use("/auth", authRoutes);
router.use("/quran", publicCache(CONTENT_CACHE_SECONDS), quranRoutes);
router.use("/hadith", publicCache(CONTENT_CACHE_SECONDS, { skipPaths: ["/today"] }), hadithRoutes);
router.use("/duas", publicCache(CONTENT_CACHE_SECONDS), duaRouter);
router.use("/qibla", qiblaRouter);
router.use("/tasbeeh", tasbeehRoutes);
router.use("/tafseer", publicCache(CONTENT_CACHE_SECONDS), tafseerRouter);
router.use("/calendar", calendarRouter);
router.use("/search", searchRoutes);
router.use("/announcements", announcementRouter);
router.use("/reminders", reminderRouter);
router.use("/admin", adminRoutes);
router.use("/bookmarks", bookmarkRoutes);
router.use("/notes", noteRoutes);
router.use("/progress", progressRoutes);
router.use("/prayer", prayerRoutes);
router.use("/ramadan", ramadanRoutes);
router.use("/goals", goalRoutes);
router.use("/notifications", notificationRoutes);
router.use("/users", userRoutes);
router.use("/assistant", assistantRoutes);
router.use("/recitation", recitationRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/settings", settingsRoutes);
router.use("/feedback", feedbackRoutes);
router.use("/cron", cronRoutes);

// Simple health check ("is the process alive?"). Cheap, no database.
router.get("/health", (req, res) => {
  res.json({ success: true, message: "SIRAJ API is running", timestamp: new Date().toISOString() });
});

// Readiness check ("can it really serve users?"). Answers 503 while MongoDB is not connected, so a
// host / load balancer / uptime monitor can tell. Gives no secrets and no details beyond the state.
router.get("/health/ready", (req, res) => {
  const ready = mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json({
    success: ready,
    message: ready ? "SIRAJ API is ready" : "SIRAJ API is not ready (database not connected)",
    database: ready ? "connected" : "not connected",
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
