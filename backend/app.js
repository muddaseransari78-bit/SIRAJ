const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const compression = require("compression");

const apiRoutes = require("./routes/index");
const { errorHandler, notFound } = require("./middleware/errorHandler");
const requestMetrics = require("./middleware/metrics");
const sanitizeInput = require("./middleware/sanitizeInput");
const { noStore } = require("./middleware/cachePolicy");
const { apiLimiter } = require("./middleware/rateLimiters");

const app = express();

// Behind a hosting proxy (Render, Railway...) set TRUST_PROXY=1 so rate limits use the real client IP
if (Number(process.env.TRUST_PROXY)) app.set("trust proxy", Number(process.env.TRUST_PROXY));

// Security headers (HSTS is switched on automatically by helmet; browsers only obey it over HTTPS)
app.use(helmet());

// Smaller responses = faster pages (gzip-compresses the JSON text)
app.use(compression());

// Allow the frontend origin to send credentials (refresh token cookie)
app.use(
  cors({
    // CLIENT_URL can hold several addresses separated by commas
    // (a trailing "/" typed by mistake is removed: browsers send the address without it, so it would never match)
    origin: (process.env.CLIENT_URL || "http://localhost:5173").split(",").map((u) => u.trim().replace(/\/+$/, "")).filter(Boolean),
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

// Phase 20 security: remove Mongo operators ($gt, $ne ...) and prototype keys from every request
app.use(sanitizeInput);

if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

// Mount every /api/* route (requestMetrics feeds Admin -> System Status).
// apiLimiter = general rate limit, noStore = private data is never cached (public content opts in, see routes/index.js)
app.use("/api", requestMetrics, apiLimiter, noStore, apiRoutes);

app.get("/", (req, res) => {
  res.json({ message: "SIRAJ 🕯️ API - Illuminate Your Heart With Knowledge" });
});

// 404 + centralized error handler must be registered LAST
app.use(notFound);
app.use(errorHandler);

module.exports = app;
