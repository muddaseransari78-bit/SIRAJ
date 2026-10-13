const test = require("node:test");
const assert = require("node:assert");
const { qiblaBearing, distanceToKaabaKm } = require("../utils/qibla");
const { parseCoords } = require("../controllers/duaQiblaController");

const near = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} is not within ${tol} of ${b}`);

test("known Qibla bearings (published values, +-1.5 degrees)", () => {
  near(qiblaBearing(31.5204, 74.3587), 260.4, 1.0);   // Lahore ~ 260
  near(qiblaBearing(51.5072, -0.1276), 119, 1.5);     // London ~ 119
  near(qiblaBearing(40.7128, -74.006), 58.5, 1.5);    // New York ~ 58
  near(qiblaBearing(-33.8688, 151.2093), 277, 1.5);   // Sydney ~ 277
  near(qiblaBearing(35.6762, 139.6503), 293, 1.5);    // Tokyo ~ 293
});

test("due south of Makkah points north, due north points south", () => {
  near(qiblaBearing(0, 39.826206), 0, 0.01);
  const b = qiblaBearing(50, 39.826206);
  near(b, 180, 0.01);
});

test("distance: Lahore ~ 3,600 km, same place = 0", () => {
  near(distanceToKaabaKm(31.5204, 74.3587), 3600, 100);
  near(distanceToKaabaKm(21.422487, 39.826206), 0, 0.01);
});

test("coordinates are validated", () => {
  assert.deepStrictEqual(parseCoords({ lat: "31.5", lng: "74.3" }), { latitude: 31.5, longitude: 74.3 });
  for (const bad of [{}, { lat: "91", lng: "0" }, { lat: "0", lng: "181" }, { lat: "x", lng: "0" }, { lat: "", lng: "" }]) {
    assert.throws(() => parseCoords(bad), (e) => e.statusCode === 400);
  }
});
