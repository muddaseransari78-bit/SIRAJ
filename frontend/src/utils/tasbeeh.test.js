import test from "node:test";
import assert from "node:assert";
import {
  DEFAULT_STATE, MAX_COUNT, MAX_TARGET, addTap, clampTarget, dhikrLabel, litBeads, progressOf, resetCount, sanitizeState, undoTap,
} from "./tasbeeh.js";

const TODAY = "2026-10-02";
const fresh = () => sanitizeState(null, TODAY);

test("target is a whole number from 1 to the maximum", () => {
  assert.strictEqual(clampTarget("45"), 45);
  assert.strictEqual(clampTarget("0"), 33);
  assert.strictEqual(clampTarget("abc"), 33);
  assert.strictEqual(clampTarget(-5, 99), 99);
  assert.strictEqual(clampTarget(2.9), 2);
  assert.strictEqual(clampTarget(10 ** 9), MAX_TARGET);
});

test("progress: rounds, position in round, full ring at the end of a round", () => {
  assert.deepStrictEqual(progressOf(0, 33), { rounds: 0, inRound: 0, pct: 0, justCompleted: false });
  assert.deepStrictEqual(progressOf(10, 33), { rounds: 0, inRound: 10, pct: 30, justCompleted: false });
  assert.deepStrictEqual(progressOf(33, 33), { rounds: 1, inRound: 0, pct: 100, justCompleted: true });
  assert.deepStrictEqual(progressOf(34, 33), { rounds: 1, inRound: 1, pct: 3, justCompleted: false });
  assert.strictEqual(progressOf(99, 99).rounds, 1);
  assert.strictEqual(progressOf(5, 0).inRound, 5); // bad target falls back to 33
});

test("lit beads follow the progress of the round", () => {
  assert.strictEqual(litBeads(0, 33), 0);
  assert.strictEqual(litBeads(17, 33), 17);
  assert.strictEqual(litBeads(33, 33), 33);
  assert.strictEqual(litBeads(50, 100), 17); // half way through a 100-round
});

test("tap, undo and reset", () => {
  let s = fresh();
  s = addTap(s, TODAY); s = addTap(s, TODAY); s = addTap(s, TODAY);
  assert.strictEqual(s.counts.subhanallah, 3);
  assert.strictEqual(s.daily.total, 3);
  s = undoTap(s, TODAY);
  assert.strictEqual(s.counts.subhanallah, 2);
  assert.strictEqual(s.daily.total, 2);
  s = resetCount(s);
  assert.strictEqual(s.counts.subhanallah, undefined);
  assert.strictEqual(s.daily.total, 2); // today's total is kept
  assert.strictEqual(undoTap(s, TODAY), s); // nothing to undo
});

test("every dhikr keeps its own count", () => {
  let s = fresh();
  s = addTap(s, TODAY);
  s = { ...s, dhikrId: "alhamdulillah" };
  s = addTap(s, TODAY); s = addTap(s, TODAY);
  assert.deepStrictEqual(s.counts, { subhanallah: 1, alhamdulillah: 2 });
  assert.strictEqual(s.daily.total, 3);
});

test("the daily total starts again on a new day", () => {
  let s = fresh();
  s = addTap(s, TODAY);
  s = addTap(s, "2026-10-03");
  assert.deepStrictEqual(s.daily, { date: "2026-10-03", total: 1 });
});

test("the count stops at the maximum", () => {
  const s = { ...fresh(), counts: { subhanallah: MAX_COUNT } };
  assert.strictEqual(addTap(s, TODAY), s);
});

test("saved data is cleaned: unknown dhikr, bad numbers, other day, long text", () => {
  const s = sanitizeState({
    dhikrId: "hacked", counts: { subhanallah: "7", evil: 5, alhamdulillah: -3, custom: 2.8 }, target: "0",
    customText: "x".repeat(100), vibrate: false, sound: "yes", daily: { date: "2026-09-01", total: 500 },
  }, TODAY);
  assert.strictEqual(s.dhikrId, DEFAULT_STATE.dhikrId);
  assert.deepStrictEqual(s.counts, { subhanallah: 7, custom: 2 });
  assert.strictEqual(s.target, 33);
  assert.strictEqual(s.customText.length, 60);
  assert.strictEqual(s.vibrate, false);
  assert.strictEqual(s.sound, false);
  assert.deepStrictEqual(s.daily, { date: TODAY, total: 0 });
  assert.deepStrictEqual(sanitizeState("garbage", TODAY).counts, {});
});

test("session name: preset, custom text, empty custom", () => {
  assert.strictEqual(dhikrLabel({ ...fresh(), dhikrId: "allahuakbar" }), "Allahu Akbar");
  assert.strictEqual(dhikrLabel({ ...fresh(), dhikrId: "custom", customText: "  Ya Latif " }), "Ya Latif");
  assert.strictEqual(dhikrLabel({ ...fresh(), dhikrId: "custom", customText: " " }), "Custom dhikr");
});
