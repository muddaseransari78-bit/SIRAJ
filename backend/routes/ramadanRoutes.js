const express = require("express");
const ctl = require("../controllers/ramadanController");
const { requireAuth } = require("../middleware/auth");
const { requireRamadanEnabled } = require("../middleware/featureFlags");

const router = express.Router();

// An admin can switch all Ramadan features off (Admin -> Settings)
router.use(requireRamadanEnabled);

// Public: nothing personal in these
router.get("/info", ctl.getInfo);
router.get("/timetable", ctl.getTimetable);
router.get("/duas", ctl.getDuas);

// Private: the user's own fasting record
router.get("/fasting", requireAuth, ctl.getFasting);
router.post("/fasting", requireAuth, ctl.setFasting);

module.exports = router;
