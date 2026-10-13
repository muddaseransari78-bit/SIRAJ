// Tiny in-memory record of the last requests (for Admin -> System Status).
// It starts again from zero whenever the server restarts - it is a quick health hint, not a monitoring product.
const MAX_SAMPLES = 1000;
const samples = [];
const startedAt = Date.now();
let total = 0;

function record(ms, status) {
  total += 1;
  samples.push({ ms, status });
  if (samples.length > MAX_SAMPLES) samples.shift();
}

function snapshot() {
  return { samples: samples.slice(), totalSinceStart: total, startedAt };
}

module.exports = { record, snapshot, MAX_SAMPLES };
