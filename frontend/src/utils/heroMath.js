// Pure helpers for the 3D hero (Phase 21 - final 3D polish). No three.js here, so they are easy to test.

// ---- Quality tiers: how much the hero is allowed to draw ----
// "high" for good devices, "medium" for ordinary phones/laptops. (Weak devices never reach the 3D hero: Lite mode.)
export const QUALITY = {
  high: { particles: 420, stars: 260, dpr: [1, 1.75], rings: 3, antialias: true },
  medium: { particles: 180, stars: 120, dpr: [1, 1.25], rings: 2, antialias: false },
};

export function pickQuality(env = {}) {
  const nav = env.navigator || {};
  const cores = nav.hardwareConcurrency || 8;
  const memory = nav.deviceMemory || 8;
  const small = typeof env.width === "number" && env.width < 640;
  return cores <= 4 || memory <= 4 || small ? "medium" : "high";
}

// ---- Parallax camera: move gently towards where the pointer is ----
// pointer is -1..1 on both axes. Returns the camera x/y target; max is how far (in scene units) it may drift.
export function parallaxTarget(pointer, max = { x: 0.6, y: 0.35 }) {
  const clamp = (v) => Math.max(-1, Math.min(1, Number.isFinite(v) ? v : 0));
  return { x: clamp(pointer.x) * max.x, y: clamp(pointer.y) * max.y };
}

// Frame-rate independent smoothing (same speed on 30 fps and 144 fps screens).
export function damp(current, target, lambda, delta) {
  return current + (target - current) * (1 - Math.exp(-lambda * delta));
}

// ---- Islamic geometric pattern: the 8-pointed star (Khatam) ----
// Returns [[x, y], ...] of a closed star outline. points = 8, inner/outer radius ratio controls how sharp it is.
export function starPolygon(points = 8, outer = 1, inner = 0.62) {
  const out = [];
  const step = Math.PI / points;
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = i * step - Math.PI / 2;
    out.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return out;
}

// The classic Khatam is two squares turned 45 degrees: returns two closed outlines.
export function khatamSquares(radius = 1) {
  const square = (rot) => [0, 1, 2, 3].map((i) => {
    const a = rot + (i * Math.PI) / 2;
    return [Math.cos(a) * radius, Math.sin(a) * radius];
  });
  return [square(Math.PI / 4), square(0)];
}

// Flat Float32Array of line SEGMENTS (pairs of points) from closed outlines, ready for <lineSegments>.
export function outlinesToSegments(outlines, z = 0) {
  const pts = [];
  for (const shape of outlines) {
    for (let i = 0; i < shape.length; i++) {
      const [x1, y1] = shape[i];
      const [x2, y2] = shape[(i + 1) % shape.length];
      pts.push(x1, y1, z, x2, y2, z);
    }
  }
  return new Float32Array(pts);
}

// ---- Mosque skyline silhouette (flat, bottom of the scene) ----
// Returns one closed outline [[x, y], ...] of dome + two minarets, width 1 = total width, y from 0 up to ~0.55.
// Built from simple arcs so there is no image to download.
export function mosqueSkyline(arcSteps = 14) {
  const pts = [];
  const push = (x, y) => pts.push([x, y]);
  push(-0.5, 0);
  // left minaret (tall, thin, pointed top)
  push(-0.5, 0.32); push(-0.485, 0.32); push(-0.485, 0.46); push(-0.47, 0.5); push(-0.455, 0.46);
  push(-0.455, 0.32); push(-0.44, 0.32); push(-0.44, 0.16);
  // small side dome
  for (let i = 0; i <= arcSteps; i++) {
    const a = Math.PI - (i / arcSteps) * Math.PI;
    push(-0.3 + Math.cos(a) * 0.14, 0.16 + Math.sin(a) * 0.12);
  }
  push(-0.16, 0.16);
  // main dome with a little finial
  for (let i = 0; i <= arcSteps; i++) {
    const a = Math.PI - (i / arcSteps) * Math.PI;
    push(Math.cos(a) * 0.16, 0.16 + Math.sin(a) * 0.2);
  }
  push(0.005, 0.38); push(0.005, 0.44); push(-0.005, 0.44); push(-0.005, 0.38);
  push(0.16, 0.16);
  // right small dome
  for (let i = 0; i <= arcSteps; i++) {
    const a = Math.PI - (i / arcSteps) * Math.PI;
    push(0.3 + Math.cos(a) * 0.14, 0.16 + Math.sin(a) * 0.12);
  }
  push(0.44, 0.16); push(0.44, 0.32); push(0.455, 0.32); push(0.455, 0.46); push(0.47, 0.5); push(0.485, 0.46);
  push(0.485, 0.32); push(0.5, 0.32);
  push(0.5, 0);
  return pts;
}

// ---- Lantern flicker: two sine waves of different speed look like a real flame ----
export function flicker(t) {
  return 1 + Math.sin(t * 3.1) * 0.04 + Math.sin(t * 7.3 + 1.7) * 0.025;
}

// ---- Twinkling stars ----
// Opacity 0.35..1 for star number i at time t. Each star has its own speed and phase from its index.
export function twinkle(i, t) {
  const speed = 0.6 + ((i * 37) % 11) / 8;
  const phase = (i * 12.9898) % (Math.PI * 2);
  return 0.675 + Math.sin(t * speed + phase) * 0.325;
}
