import test from "node:test";
import assert from "node:assert";
import {
  qiblaBearing, distanceToKaabaKm, normalize360, shortestDelta, cardinal, headingFromEvent,
  smoothHeading, isAligned, turnAdvice, formatKm,
} from "./qibla.js";

const near = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} not within ${tol} of ${b}`);

test("Qibla bearings match published values", () => {
  near(qiblaBearing(31.5204, 74.3587), 260.4, 1);
  near(qiblaBearing(51.5072, -0.1276), 119, 1.5);
  near(qiblaBearing(40.7128, -74.006), 58.5, 1.5);
  near(qiblaBearing(-33.8688, 151.2093), 277, 1.5);
});

test("distance and cardinal names", () => {
  near(distanceToKaabaKm(31.5204, 74.3587), 3600, 100);
  assert.strictEqual(formatKm(3598.4), "3,598 km");
  assert.strictEqual(cardinal(260), "W");
  assert.strictEqual(cardinal(359), "N");
  assert.strictEqual(cardinal(119), "ESE");
});

test("angle wrap-around", () => {
  assert.strictEqual(normalize360(-10), 350);
  assert.strictEqual(normalize360(370), 10);
  assert.strictEqual(shortestDelta(350, 10), 20);
  assert.strictEqual(shortestDelta(10, 350), -20);
  assert.strictEqual(shortestDelta(0, 180), 180);
});

test("heading from device events", () => {
  assert.strictEqual(headingFromEvent({ webkitCompassHeading: 90 }), 90);
  assert.strictEqual(headingFromEvent({ type: "deviceorientationabsolute", alpha: 90 }), 270);
  assert.strictEqual(headingFromEvent({ type: "deviceorientation", absolute: true, alpha: 0 }), 0);
  assert.strictEqual(headingFromEvent({ type: "deviceorientation", absolute: false, alpha: 90 }), null); // not north-based
  assert.strictEqual(headingFromEvent({ type: "deviceorientation", alpha: null }), null);
});

test("smoothing crosses north correctly", () => {
  assert.strictEqual(smoothHeading(null, 40), 40);
  const s = smoothHeading(350, 10, 0.5);
  assert.strictEqual(s, 0);
});

test("alignment has hysteresis and clear advice", () => {
  assert.strictEqual(isAligned(3, false), true);
  assert.strictEqual(isAligned(5, false), false);
  assert.strictEqual(isAligned(5, true), true);
  assert.strictEqual(isAligned(8, true), false);
  assert.strictEqual(turnAdvice(32.4), "Turn right 32°");
  assert.strictEqual(turnAdvice(-12), "Turn left 12°");
  assert.strictEqual(turnAdvice(0.2), "Facing the Qibla");
});
