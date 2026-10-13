// How long the loading screen lasts and which version of it to show (Phase 36).
// fancy = 3D logo, rings and sparks.  Lite mode / "reduce motion" get a calm flat logo and a short wait.
export function splashPlan({ lite = false, reduced = false } = {}) {
  if (lite || reduced) return { fancy: false, minMs: 650, maxMs: 2500 };
  return { fancy: true, minMs: 2200, maxMs: 6000 };
}

// 0..1 progress that eases towards 0.9 while we wait (never reaches 1 by itself)
export function easedProgress(elapsedMs, minMs) {
  const e = Math.max(0, Number(elapsedMs) || 0);
  const m = Math.max(1, Number(minMs) || 1);
  return Math.min(0.9, 1 - Math.exp(-e / (m * 0.55)));
}
