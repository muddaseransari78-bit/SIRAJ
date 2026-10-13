const metrics = require("../utils/metrics");

// Measures how long each /api request took. Never changes the response.
function requestMetrics(req, res, next) {
  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    metrics.record(ms, res.statusCode);
  });
  next();
}

module.exports = requestMetrics;
