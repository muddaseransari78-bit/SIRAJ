import test from "node:test";
import assert from "node:assert";
import { applyCorrection, clampCorrection } from "./qibla.js";

test("correction is added and wraps around 360", () => {
  assert.strictEqual(applyCorrection(10, 5), 15);
  assert.strictEqual(applyCorrection(358, 5), 3);
  assert.strictEqual(applyCorrection(2, -5), 357);
});

test("correction is limited to +-30 and bad input becomes 0", () => {
  assert.strictEqual(clampCorrection(99), 30);
  assert.strictEqual(clampCorrection(-99), -30);
  assert.strictEqual(clampCorrection("abc"), 0);
  assert.strictEqual(clampCorrection(2.6), 3);
  assert.strictEqual(applyCorrection(100, 99), 130);
});
