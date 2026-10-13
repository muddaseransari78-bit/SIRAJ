const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const { getSettings } = require("../services/settingsService");

const router = express.Router();

// Public: the website reads this to show the site notice and hide switched-off features.
router.get("/public", asyncHandler(async (req, res) => {
  const s = await getSettings();
  return sendSuccess(res, { message: "Public settings", data: { settings: s } });
}));

module.exports = router;
