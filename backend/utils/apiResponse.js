/**
 * Sends a consistent success response shape across the entire API.
 */
function sendSuccess(res, { statusCode = 200, message = "Success", data = null }) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
}

/**
 * Sends a consistent error response shape across the entire API.
 * Never leaks stack traces to the client in production.
 */
function sendError(res, { statusCode = 500, message = "Something went wrong", error = null }) {
  const payload = {
    success: false,
    message,
  };

  if (process.env.NODE_ENV !== "production" && error) {
    payload.error = error;
  }

  return res.status(statusCode).json(payload);
}

module.exports = { sendSuccess, sendError };
