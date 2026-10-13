const express = require("express");
const bookmarkController = require("../controllers/bookmarkController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// All bookmark routes require a logged-in user
router.use(requireAuth);

// Collections (must be declared before "/:id" routes)
router.get("/collections", bookmarkController.getCollections);
router.post("/collections", bookmarkController.createCollection);
router.patch("/collections/rename", bookmarkController.renameCollection);
router.delete("/collections", bookmarkController.deleteCollection);

router.get("/", bookmarkController.getMyBookmarks);
router.post("/", bookmarkController.addBookmark);
router.patch("/:id", bookmarkController.moveBookmark);
router.delete("/:id", bookmarkController.removeBookmark);

module.exports = router;
