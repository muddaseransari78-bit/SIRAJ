const express = require("express");
const ctl = require("../controllers/goalController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);
router.get("/", ctl.listGoals);
router.put("/:type", ctl.setGoal);
router.delete("/:type", ctl.deleteGoal);

module.exports = router;
