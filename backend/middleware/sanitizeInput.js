const { sanitizeValue } = require("../utils/sanitize");

// Cleans req.body, req.query and req.params before any controller sees them.
// Register it AFTER express.json() so the body is already parsed.
function sanitizeInput(req, res, next) {
  if (req.body) req.body = sanitizeValue(req.body);
  if (req.query) {
    // In Express 4 req.query can be replaced safely.
    try { req.query = sanitizeValue(req.query); } catch (e) { /* read-only in some setups: leave as is */ }
  }
  if (req.params) req.params = sanitizeValue(req.params);
  next();
}

module.exports = sanitizeInput;
