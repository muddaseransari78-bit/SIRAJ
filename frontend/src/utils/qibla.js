// Qibla + compass helpers. Pure functions (no React, no browser APIs) so they can be unit-tested.
// Same formula as backend/utils/qibla.js - so the page still works if the backend is down.

export const KAABA = { lat: 21.422487, lng: 39.826206 };
const EARTH_RADIUS_KM = 6371;
const toRad = (d) => (d * Math.PI) / 180;
const toDeg = (r) => (r * 180) / Math.PI;

/** Any angle -> 0..360 */
export function normalize360(deg) {
  return ((deg % 360) + 360) % 360;
}

/** Smallest signed turn from `from` to `to`, in -180..180 (positive = turn clockwise / right). */
export function shortestDelta(from, to) {
  let d = normalize360(to) - normalize360(from);
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

/** Bearing from a place to the Kaaba: degrees clockwise from TRUE north. */
export function qiblaBearing(lat, lng) {
  const phi1 = toRad(lat);
  const phi2 = toRad(KAABA.lat);
  const dLambda = toRad(KAABA.lng - lng);
  const y = Math.sin(dLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);
  return normalize360(toDeg(Math.atan2(y, x)));
}

export function distanceToKaabaKm(lat, lng) {
  const dPhi = toRad(KAABA.lat - lat);
  const dLambda = toRad(KAABA.lng - lng);
  const a = Math.sin(dPhi / 2) ** 2 + Math.cos(toRad(lat)) * Math.cos(toRad(KAABA.lat)) * Math.sin(dLambda / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** "W", "NNE" ... for a bearing */
export function cardinal(deg) {
  const names = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return names[Math.round(normalize360(deg) / 22.5) % 16];
}

export function formatKm(km) {
  return `${Math.round(km).toLocaleString("en-US")} km`;
}

/**
 * Heading (degrees clockwise from north, where the TOP of the phone points) from a device orientation event.
 * - iPhone/iPad give `webkitCompassHeading` directly.
 * - Android "deviceorientationabsolute": heading = 360 - alpha.
 * - A plain `deviceorientation` event is NOT north-based on most Android phones, so it returns null
 *   (showing a wrong direction would be worse than showing nothing).
 * Works best with the phone held flat.
 */
export function headingFromEvent(e) {
  if (typeof e.webkitCompassHeading === "number" && Number.isFinite(e.webkitCompassHeading)) {
    return normalize360(e.webkitCompassHeading);
  }
  const absolute = e.absolute === true || e.type === "deviceorientationabsolute";
  if (absolute && typeof e.alpha === "number" && Number.isFinite(e.alpha)) {
    return normalize360(360 - e.alpha);
  }
  return null;
}

/** Low-pass filter that handles the 359 -> 1 wrap-around. `factor` 0..1 (higher = faster). */
export function smoothHeading(previous, next, factor = 0.25) {
  if (previous == null) return normalize360(next);
  return normalize360(previous + shortestDelta(previous, next) * factor);
}

/**
 * How far the phone must turn to face the Qibla. `diff` = shortestDelta(heading, qibla).
 * Uses hysteresis (enter < 4 degrees, leave > 7) so the "aligned" state does not flicker.
 */
export function isAligned(diff, wasAligned) {
  const a = Math.abs(diff);
  return wasAligned ? a <= 7 : a <= 4;
}

export function turnAdvice(diff) {
  const a = Math.round(Math.abs(diff));
  if (a === 0) return "Facing the Qibla";
  return `Turn ${diff > 0 ? "right" : "left"} ${a}°`;
}

/**
 * Manual compass correction: the user can add -30..+30 degrees to every reading
 * (phone compasses point to magnetic north and can be a few degrees off).
 */
export const MAX_CORRECTION = 30;
export function clampCorrection(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(-MAX_CORRECTION, Math.min(MAX_CORRECTION, Math.round(n)));
}
export function applyCorrection(heading, correction) {
  return normalize360(heading + clampCorrection(correction));
}
