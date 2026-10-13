const { sendError } = require("../utils/apiResponse");

/**
 * Restricts a route to specific roles. Must run AFTER requireAuth,
 * since it relies on req.user being set.
 *
 * Usage: router.get("/admin/stats", requireAuth, roleGuard(["ADMIN", "SUPER_ADMIN"]), controller)
 */
function roleGuard(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, { statusCode: 401, message: "Authentication required" });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return sendError(res, { statusCode: 403, message: "You do not have permission to do this" });
    }

    next();
  };
}

module.exports = roleGuard;
