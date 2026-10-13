import test from "node:test";
import assert from "node:assert/strict";
import { QUALITY, damp, flicker, khatamSquares, mosqueSkyline, outlinesToSegments, parallaxTarget, pickQuality, starPolygon, twinkle } from "./heroMath.js";

test("quality tier: good desktop is high, weak or small screens are medium", () => {
  assert.equal(pickQuality({ navigator: { hardwareConcurrency: 8, deviceMemory: 8 }, width: 1440 }), "high");
  assert.equal(pickQuality({ navigator: { hardwareConcurrency: 4, deviceMemory: 8 }, width: 1440 }), "medium");
  assert.equal(pickQuality({ navigator: { hardwareConcurrency: 8, deviceMemory: 4 }, width: 1440 }), "medium");
  assert.equal(pickQuality({ navigator: { hardwareConcurrency: 8, deviceMemory: 8 }, width: 390 }), "medium");
  assert.equal(pickQuality({}), "high"); // unknown browsers (Safari) are not punished
  assert.ok(QUALITY.medium.particles < QUALITY.high.particles && QUALITY.medium.dpr[1] < QUALITY.high.dpr[1]);
});

test("parallax stays inside its limits and survives bad input", () => {
  assert.deepEqual(parallaxTarget({ x: 1, y: -1 }), { x: 0.6, y: -0.35 });
  assert.deepEqual(parallaxTarget({ x: 5, y: 9 }), { x: 0.6, y: 0.35 });
  assert.deepEqual(parallaxTarget({ x: NaN, y: undefined }), { x: 0, y: 0 });
  assert.deepEqual(parallaxTarget({ x: 0, y: 0 }), { x: 0, y: 0 });
});

test("damp moves towards the target, never past it, and is frame-rate independent", () => {
  const one = damp(0, 10, 5, 1 / 60);
  assert.ok(one > 0 && one < 10);
  assert.ok(Math.abs(damp(0, 10, 5, 100) - 10) < 1e-6);
  let a = 0; for (let i = 0; i < 60; i++) a = damp(a, 10, 5, 1 / 60);
  let b = 0; for (let i = 0; i < 120; i++) b = damp(b, 10, 5, 1 / 120);
  assert.ok(Math.abs(a - b) < 1e-9);
  assert.equal(damp(3, 3, 5, 0.016), 3);
});

test("star polygon has 2 x points vertices, alternating radius", () => {
  const star = starPolygon(8, 1, 0.6);
  assert.equal(star.length, 16);
  const r = (p) => Math.hypot(p[0], p[1]);
  assert.ok(star.every((p, i) => Math.abs(r(p) - (i % 2 === 0 ? 1 : 0.6)) < 1e-9));
  assert.ok(Math.abs(star[0][0]) < 1e-9 && Math.abs(star[0][1] + 1) < 1e-9); // first tip points up
});

test("khatam is two squares turned 45 degrees, all corners on the circle", () => {
  const [a, b] = khatamSquares(2);
  assert.equal(a.length, 4); assert.equal(b.length, 4);
  for (const p of [...a, ...b]) assert.ok(Math.abs(Math.hypot(p[0], p[1]) - 2) < 1e-9);
  const angle = (p) => Math.atan2(p[1], p[0]);
  assert.ok(Math.abs(Math.abs(angle(a[0]) - angle(b[0])) - Math.PI / 4) < 1e-9);
});

test("outlinesToSegments makes 2 points per edge and closes the shape", () => {
  const seg = outlinesToSegments([[[0, 0], [1, 0], [1, 1]]], 0.5);
  assert.equal(seg.length, 3 * 6); // 3 edges x 2 points x 3 numbers
  assert.deepEqual(Array.from(seg.slice(12, 18)), [1, 1, 0.5, 0, 0, 0.5]); // last edge returns to the start
  assert.equal(outlinesToSegments([]).length, 0);
});

test("mosque skyline is a symmetric, closed-at-the-ground outline", () => {
  const pts = mosqueSkyline();
  assert.equal(pts[0][1], 0); assert.equal(pts[pts.length - 1][1], 0);
  assert.equal(pts[0][0], -0.5); assert.equal(pts[pts.length - 1][0], 0.5);
  const maxY = Math.max(...pts.map((p) => p[1]));
  assert.ok(maxY > 0.45 && maxY <= 0.55);
  assert.ok(pts.every((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]) && p[0] >= -0.5 && p[0] <= 0.5));
  // left/right mirror (points on the centre line, like the dome tip and finial, belong to neither side)
  const key = (p) => `${Math.abs(p[0]).toFixed(4)},${p[1].toFixed(4)}`;
  const left = pts.filter((p) => p[0] < -1e-6).map(key).sort();
  const right = pts.filter((p) => p[0] > 1e-6).map(key).sort();
  assert.ok(left.length > 20);
  assert.deepEqual(left, right);
});

test("flame flicker stays gentle and twinkle stays in 0.35..1", () => {
  for (let t = 0; t < 60; t += 0.37) {
    const f = flicker(t);
    assert.ok(f > 0.9 && f < 1.1, `flicker ${f}`);
  }
  for (let i = 0; i < 400; i++) for (const t of [0, 1.3, 7.7, 42]) {
    const o = twinkle(i, t);
    assert.ok(o >= 0.349 && o <= 1.001, `twinkle ${o}`);
  }
  assert.notEqual(twinkle(1, 5), twinkle(2, 5)); // stars do not blink in sync
});
