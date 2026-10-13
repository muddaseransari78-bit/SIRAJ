const mongoose = require("mongoose");
const { sendError } = require("../utils/apiResponse");
const ErrorLog = require("../models/ErrorLog");

// Saves server errors (5xx) for the admin "Error Logs" page. Never blocks or breaks the response.
function logToDatabase(err, req, statusCode) {
  if (statusCode < 500 || mongoose.connection.readyState !== 1) return;
  ErrorLog.create({
    method: req.method,
    path: (req.originalUrl || "").split("?")[0].slice(0, 300), // no query string (may hold personal data)
    statusCode,
    message: String(err.message || "Internal server error").slice(0, 500),
    user: req.user?.id || null,
  }).catch(() => {});
}

/**
 * Catches any error passed via next(err) or thrown in an async route
 * (via asyncHandler) and turns it into a consistent JSON response.
 * This must be registered LAST, after all routes, in app.js.
 */
function errorHandler(err, req, res, next) {
  console.error(`[SIRAJ ERROR] ${req.method} ${req.originalUrl} ->`, err.message);

  // Bad data from the browser (wrong type, missing field, too long, malformed id) is the client's
  // mistake (400), not a server crash (500). It also keeps these out of the admin "Error Logs".
  if (!err.statusCode && (err.name === "ValidationError" || err.name === "CastError")) {
    err.statusCode = 400;
    err.message = err.name === "CastError" ? `Invalid value for "${err.path || "field"}"` : "Some of the data you sent is not valid";
  }

  const statusCode = err.statusCode || 500;
  const message = statusCode >= 500 && process.env.NODE_ENV === "production" ? "Internal server error" : err.message || "Internal server error";

  logToDatabase(err, req, statusCode);

  return sendError(res, {
    statusCode,
    message,
    error: process.env.NODE_ENV !== "production" ? err.stack : null,
  });
}

/**
 * Handles requests to routes that don't exist.
 */
function notFound(req, res, next) {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
}

module.exports = { errorHandler, notFound };
