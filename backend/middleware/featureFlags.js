const { getSettings } = require("../services/settingsService");
const { sendError } = require("../utils/apiResponse");

// Blocks /api/ramadan/* while an admin has switched Ramadan features off.
async function requireRamadanEnabled(req, res, next) {
  const settings = await getSettings();
  if (!settings.ramadanEnabled) {
    return sendError(res, { statusCode: 403, message: "Ramadan features are switched off right now" });
  }
  next();
}

module.exports = { requireRamadanEnabled };
