require("dotenv").config();

// Friendly start-up check of backend/.env (see utils/envCheck.js).
// Production: any error stops the server. Development: problems are only warnings (except missing values).
const { checkEnv } = require("./utils/envCheck");
const { errors, warnings } = checkEnv(process.env);
warnings.forEach((w) => console.warn(`[SIRAJ] Warning: ${w}`));
if (errors.length) {
  errors.forEach((e) => console.error(`[SIRAJ] ${e}`));
  console.error("[SIRAJ] Fix: copy .env.example to .env (copy .env.example .env), fill the values, then restart.");
  console.error('[SIRAJ] Make a strong secret with: npm run secrets');
  process.exit(1);
}

const mongoose = require("mongoose");
const app = require("./app");
const connectDB = require("./config/db");
const { createShutdown } = require("./utils/shutdown");
const { startScheduler } = require("./services/pushService");

const PORT = process.env.PORT || 5000;

// A forgotten promise error must not silently kill (or silently hide) problems: log it.
process.on("unhandledRejection", (reason) => {
  console.error("[SIRAJ] Unhandled promise rejection:", reason && reason.message ? reason.message : reason);
});
// After an uncaught exception the process state is unknown: log and let the host restart us.
process.on("uncaughtException", (err) => {
  console.error("[SIRAJ] Uncaught exception:", err);
  process.exit(1);
});

connectDB().then(() => {
  const server = app.listen(PORT, () => {
    console.log(`[SIRAJ] Server running on http://localhost:${PORT}`);
  });

  // Phase 31: prayer / Jamaat reminders pushed from the server (only runs when the VAPID keys are in .env)
  const stopScheduler = startScheduler();

  const shutdown = createShutdown({ server: { close: (cb) => { stopScheduler(); server.close(cb); } }, mongoose });
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
});
