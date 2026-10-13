const express = require("express");
const ctl = require("../controllers/notificationController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);
router.get("/", ctl.list);
router.get("/unread-count", ctl.unreadCount);
router.patch("/read-all", ctl.markAllRead); // must come before "/:id/read"
router.patch("/:id/read", ctl.markRead);
router.delete("/:id", ctl.remove);

module.exports = router;
