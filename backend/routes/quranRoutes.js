const express = require("express");
const quranController = require("../controllers/quranController");

const router = express.Router();

router.get("/surahs", quranController.getSurahs);
router.get("/reciters", quranController.getReciters);
router.get("/search", quranController.search);
router.get("/topics", quranController.listTopics);
router.get("/topics/:slug", quranController.getTopic);
router.get("/surah/:surahNumber/audio", quranController.getSurahAudio);
router.get("/surah/:surahNumber/tajweed", quranController.getSurahTajweed);
router.get("/surah/:surahNumber", quranController.getSurah);
router.get("/range/:type/:number", quranController.getRange);

module.exports = router;
