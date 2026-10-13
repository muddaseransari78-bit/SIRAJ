const jwt = require("jsonwebtoken");
const { sendError } = require("../utils/apiResponse");

/**
 * Verifies the JWT access token sent in the Authorization header
 * ("Bearer <token>") and attaches the decoded user payload to req.user.
 * Blocks the request with 401 if the token is missing or invalid.
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return sendError(res, { statusCode: 401, message: "Authentication required" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    req.user = decoded; // { id, role }
    next();
  } catch (err) {
    return sendError(res, { statusCode: 401, message: "Invalid or expired token" });
  }
}

/**
 * Like requireAuth, but does not block the request if there is no token.
 * Useful for routes that behave differently for logged-in vs guest users
 * (e.g. showing bookmark state on an Ayah).
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    try {
      req.user = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    } catch (err) {
      req.user = null;
    }
  }
  next();
}

module.exports = { requireAuth, optionalAuth };
