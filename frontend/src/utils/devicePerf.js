// "Lite mode" decides whether SIRAJ shows heavy 3D scenes and blur effects (Phase 20 - performance + accessibility).
//
// Lite mode is ON when:
//   - the person chose "Lite" in the footer (saved on this device), or
//   - they are on "Auto" and the device looks weak: reduced-motion setting, Data Saver, slow network,
//     2 GB memory or less, or 2 CPU cores or less.
// The checks are plain functions that receive the browser info, so they are easy to test.

export const LITE_KEY = "siraj_lite_mode"; // stored value: "auto" (default) | "lite" | "full"

export function readPreference(storage) {
  try {
    const value = storage && storage.getItem(LITE_KEY);
    return value === "lite" || value === "full" ? value : "auto";
  } catch (e) {
    return "auto";
  }
}

export function writePreference(storage, value) {
  try {
    if (!storage) return;
    if (value === "lite" || value === "full") storage.setItem(LITE_KEY, value);
    else storage.removeItem(LITE_KEY);
  } catch (e) { /* private mode: ignore */ }
}

// Why does Auto think this device is weak? Returns a short reason or "" when the device looks fine.
export function weakDeviceReason(env) {
  const nav = env.navigator || {};
  const conn = nav.connection || {};
  if (env.prefersReducedMotion) return "reduced-motion";
  if (conn.saveData) return "data-saver";
  if (conn.effectiveType === "slow-2g" || conn.effectiveType === "2g") return "slow-network";
  if (nav.deviceMemory && nav.deviceMemory <= 2) return "low-memory";
  if (nav.hardwareConcurrency && nav.hardwareConcurrency <= 2) return "few-cores";
  return "";
}

// preference: "auto" | "lite" | "full"
export function isLiteMode(preference, env) {
  if (preference === "lite") return true;
  if (preference === "full") return Boolean(env.prefersReducedMotion); // never force motion on someone who asked for less
  return weakDeviceReason(env) !== "";
}

// Reads the real browser (only called in the browser, never in tests).
export function browserEnv() {
  const mq = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  return { navigator: typeof navigator !== "undefined" ? navigator : {}, prefersReducedMotion: Boolean(mq && mq.matches) };
}
