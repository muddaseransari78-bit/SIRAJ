const express = require("express");
const c = require("../controllers/hadithController");

const router = express.Router();

router.get("/collections", c.getCollections);
router.get("/search", c.search);
router.get("/today", c.today);
router.get("/collections/:collection/books", c.getBooks);
router.get("/collections/:collection/books/:bookNumber/hadiths", c.getHadiths);
router.get("/collections/:collection/books/:bookNumber/hadiths/:hadithNumber", c.getHadith);

module.exports = router;
