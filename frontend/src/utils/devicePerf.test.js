import test from "node:test";
import assert from "node:assert/strict";
import { LITE_KEY, isLiteMode, readPreference, weakDeviceReason, writePreference } from "./devicePerf.js";

const fine = { prefersReducedMotion: false, navigator: { deviceMemory: 8, hardwareConcurrency: 8, connection: { effectiveType: "4g" } } };
const withNav = (nav, extra = {}) => ({ prefersReducedMotion: false, ...extra, navigator: { ...fine.navigator, ...nav } });

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return { data, getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); }, removeItem: (k) => { delete data[k]; } };
}

test("a normal device is not weak", () => {
  assert.equal(weakDeviceReason(fine), "");
  assert.equal(isLiteMode("auto", fine), false);
});

test("each weak signal is detected", () => {
  assert.equal(weakDeviceReason(withNav({}, { prefersReducedMotion: true })), "reduced-motion");
  assert.equal(weakDeviceReason(withNav({ connection: { saveData: true } })), "data-saver");
  assert.equal(weakDeviceReason(withNav({ connection: { effectiveType: "2g" } })), "slow-network");
  assert.equal(weakDeviceReason(withNav({ connection: { effectiveType: "slow-2g" } })), "slow-network");
  assert.equal(weakDeviceReason(withNav({ deviceMemory: 2 })), "low-memory");
  assert.equal(weakDeviceReason(withNav({ hardwareConcurrency: 2 })), "few-cores");
});

test("browsers without these APIs (Safari, Firefox) are treated as fine", () => {
  assert.equal(weakDeviceReason({ prefersReducedMotion: false, navigator: {} }), "");
  assert.equal(weakDeviceReason({ prefersReducedMotion: false }), "");
});

test("Auto follows the device, Lite always lite, Full 3D respects reduced motion", () => {
  const weak = withNav({ deviceMemory: 1 });
  assert.equal(isLiteMode("auto", weak), true);
  assert.equal(isLiteMode("lite", fine), true);
  assert.equal(isLiteMode("full", weak), false); // the person asked for full 3D on a weak device
  assert.equal(isLiteMode("full", withNav({}, { prefersReducedMotion: true })), true); // but reduced motion still wins
});

test("preference is read safely and saved only for real choices", () => {
  assert.equal(readPreference(memoryStorage()), "auto");
  assert.equal(readPreference(memoryStorage({ [LITE_KEY]: "lite" })), "lite");
  assert.equal(readPreference(memoryStorage({ [LITE_KEY]: "banana" })), "auto");
  assert.equal(readPreference(null), "auto");
  assert.equal(readPreference({ getItem() { throw new Error("blocked"); } }), "auto");

  const store = memoryStorage();
  writePreference(store, "lite");
  assert.equal(store.data[LITE_KEY], "lite");
  writePreference(store, "auto"); // auto = remove the saved choice
  assert.equal(LITE_KEY in store.data, false);
  writePreference({ setItem() { throw new Error("blocked"); }, removeItem() {} }, "lite"); // must not throw
});
