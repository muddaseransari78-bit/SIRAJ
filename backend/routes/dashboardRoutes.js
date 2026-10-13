const express = require("express");
const ctl = require("../controllers/dashboardController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

router.get("/summary", ctl.getSummary);
router.get("/reading-history", ctl.getReadingHistory);
router.get("/prayer-history", ctl.getPrayerHistory);

module.exports = router;
