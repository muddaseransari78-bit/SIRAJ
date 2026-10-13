// Qibla maths. Pure functions (no network), so it always works and can be tested.
// Kaaba (Masjid al-Haram, Makkah) coordinates.
const KAABA = { lat: 21.422487, lng: 39.826206 };
const EARTH_RADIUS_KM = 6371;

const toRad = (d) => (d * Math.PI) / 180;
const toDeg = (r) => (r * 180) / Math.PI;

/** Initial great-circle bearing from (lat,lng) to the Kaaba, in degrees clockwise from TRUE north (0-360). */
function qiblaBearing(lat, lng) {
  const phi1 = toRad(lat);
  const phi2 = toRad(KAABA.lat);
  const dLambda = toRad(KAABA.lng - lng);
  const y = Math.sin(dLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Great-circle distance to the Kaaba in km (haversine). */
function distanceToKaabaKm(lat, lng) {
  const dPhi = toRad(KAABA.lat - lat);
  const dLambda = toRad(KAABA.lng - lng);
  const a = Math.sin(dPhi / 2) ** 2 + Math.cos(toRad(lat)) * Math.cos(toRad(KAABA.lat)) * Math.sin(dLambda / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

module.exports = { KAABA, qiblaBearing, distanceToKaabaKm };
