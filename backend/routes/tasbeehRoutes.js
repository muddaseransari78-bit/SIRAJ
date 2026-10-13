const express = require("express");
const ctl = require("../controllers/tasbeehController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

router.post("/sessions", ctl.createSession);
router.get("/sessions", ctl.listSessions);
router.delete("/sessions/:id", ctl.deleteSession);

module.exports = router;
