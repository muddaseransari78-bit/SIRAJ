// Graceful shutdown (Phase 23). Hosts (Render, Railway, Docker) send SIGTERM before they stop or
// replace the server. We stop taking new requests, let running ones finish, close MongoDB, then exit.
// Dependencies are passed in so this can be tested without a real server.

function createShutdown({ server, mongoose, exit = process.exit, log = console.log, timeoutMs = 10000, setTimer = setTimeout }) {
  let started = false;
  return function shutdown(signal) {
    if (started) return; // a second signal must not start it again
    started = true;
    log(`[SIRAJ] ${signal} received, shutting down...`);

    // Safety net: if something hangs, leave anyway (exit code 1 = not clean)
    const timer = setTimer(() => {
      log("[SIRAJ] Shutdown took too long, forcing exit.");
      exit(1);
    }, timeoutMs);
    if (timer && typeof timer.unref === "function") timer.unref();

    server.close(async () => {
      try {
        await mongoose.connection.close(false);
      } catch (err) {
        log(`[SIRAJ] MongoDB close error: ${err.message}`);
      }
      log("[SIRAJ] Bye.");
      exit(0);
    });
  };
}

module.exports = { createShutdown };
