import test from "node:test";
import assert from "node:assert";
import { saveCalc, readCalc, calcParams, DEFAULT_CALC } from "./prayerCalc.js";

const fake = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v) }; };

test("nothing saved: Karachi method + Hanafi Asr", () => {
  assert.deepStrictEqual(readCalc(fake()), DEFAULT_CALC);
  assert.deepStrictEqual(calcParams(fake()), { method: 1, school: 1 });
});

test("saved method, madhab and manual adjustment come back", () => {
  const s = fake();
  saveCalc({ method: 3, school: 0, adjust: { Asr: 2 } }, s);
  assert.deepStrictEqual(readCalc(s), { method: 3, school: 0, tune: "0,0,0,0,2,0,0,0,0" });
  assert.deepStrictEqual(calcParams(s), { method: 3, school: 0, tune: "0,0,0,0,2,0,0,0,0" });
});

test("broken saved data falls back to the defaults", () => {
  const s = fake();
  s.setItem("siraj_calc", "{oops");
  assert.deepStrictEqual(readCalc(s), DEFAULT_CALC);
  s.setItem("siraj_calc", JSON.stringify({ method: 500, school: 7, tune: "x" }));
  assert.deepStrictEqual(readCalc(s), DEFAULT_CALC);
});
