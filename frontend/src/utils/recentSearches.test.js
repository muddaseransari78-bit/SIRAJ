import test from "node:test";
import assert from "node:assert";
import { addToRecent, loadRecent, saveRecent, rememberSearch, clearRecent, MAX_RECENT } from "./recentSearches.js";

const fakeStorage = (initial = {}) => {
  const data = { ...initial };
  return { getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = v; }, removeItem: (k) => { delete data[k]; }, data };
};

test("newest search goes first and duplicates are removed", () => {
  assert.deepStrictEqual(addToRecent(["patience", "qibla"], "Qibla"), ["Qibla", "patience"]);
});

test("too short searches are ignored and the list is capped", () => {
  assert.deepStrictEqual(addToRecent(["a1"], "x"), ["a1"]);
  const many = Array.from({ length: MAX_RECENT }, (_, i) => `word${i}`);
  const next = addToRecent(many, "fresh");
  assert.strictEqual(next.length, MAX_RECENT);
  assert.strictEqual(next[0], "fresh");
});

test("save, load and clear work with a storage", () => {
  const s = fakeStorage();
  rememberSearch("patience", s);
  rememberSearch("2:255", s);
  assert.deepStrictEqual(loadRecent(s), ["2:255", "patience"]);
  assert.deepStrictEqual(clearRecent(s), []);
  assert.deepStrictEqual(loadRecent(s), []);
});

test("broken or missing storage never throws", () => {
  assert.deepStrictEqual(loadRecent(fakeStorage({ siraj_recent_searches: "{not json" })), []);
  assert.deepStrictEqual(loadRecent(fakeStorage({ siraj_recent_searches: JSON.stringify({ a: 1 }) })), []);
  assert.deepStrictEqual(loadRecent(null), []);
  assert.doesNotThrow(() => saveRecent(["x1"], { setItem() { throw new Error("full"); } }));
});
