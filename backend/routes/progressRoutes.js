const express = require("express");
const progressController = require("../controllers/progressController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);

router.get("/", progressController.getMyProgress);
router.put("/", progressController.updateMyProgress);
router.get("/stats", progressController.getMyStats);
router.post("/complete", progressController.setCompleted);
router.post("/reset", progressController.resetProgress);

module.exports = router;
