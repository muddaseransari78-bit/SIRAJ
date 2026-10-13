const express = require("express");
const noteController = require("../controllers/noteController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);

router.get("/", noteController.getMyNotes);
router.post("/", noteController.addNote);
router.delete("/:id", noteController.deleteNote);

module.exports = router;
