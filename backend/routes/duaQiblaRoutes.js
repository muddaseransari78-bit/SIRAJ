const express = require("express");
const rateLimit = require("express-rate-limit");
const c = require("../controllers/duaQiblaController");

const duaRouter = express.Router();
duaRouter.get("/", c.getCategories);
duaRouter.get("/:category", c.getDuas);

const qiblaRouter = express.Router();
const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { success: false, message: "Too many searches. Please wait a minute." },
});

qiblaRouter.get("/", c.getQibla);
qiblaRouter.get("/search", searchLimiter, c.searchPlace);

module.exports = { duaRouter, qiblaRouter };
