import test from "node:test";
import assert from "node:assert";
import { alignLive, finalizeLive } from "./liveRecitation.js";
import { splitWords } from "./recitationMatch.js";

const ayah = "ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَـٰلَمِينَ";
const say = (text) => splitWords(text);
const statuses = (r) => r.words.map((w) => w.status);

test("nothing heard yet: first word is current, the rest wait", () => {
  const r = alignLive(ayah, []);
  assert.deepStrictEqual(statuses(r), ["current", "upcoming", "upcoming", "upcoming"]);
  assert.strictEqual(r.done, false);
});

test("words light up one by one while reciting", () => {
  const r = alignLive(ayah, say("الحمد لله"));
  assert.deepStrictEqual(statuses(r), ["match", "match", "current", "upcoming"]);
  assert.strictEqual(r.current, 2);
});

test("a full correct recitation is done and scores 100", () => {
  const r = alignLive(ayah, say("الحمد لله رب العالمين"));
  assert.strictEqual(r.done, true);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.doneAt, 4);
});

test("a wrong word is shown as different, with what was heard", () => {
  const r = alignLive(ayah, say("الحمد لنا"));
  assert.strictEqual(r.words[1].status, "different");
  assert.strictEqual(r.words[1].heard, "لنا");
  const after = alignLive(ayah, say("الحمد لنا رب العالمين"));
  assert.strictEqual(after.words[1].status, "different");
  assert.strictEqual(after.words[2].status, "match");
  assert.strictEqual(after.done, true);
});

test("saying the word again after a mistake fixes it and marks it as retried", () => {
  const r = alignLive(ayah, say("الحمد لنا لله رب"));
  assert.strictEqual(r.words[1].status, "match");
  assert.strictEqual(r.words[1].retried, true);
});

test("a skipped word is reported as not heard", () => {
  const r = alignLive(ayah, say("الحمد رب العالمين"));
  assert.strictEqual(r.words[1].status, "missed");
  assert.strictEqual(r.done, true);
});

test("words after the Ayah belong to the next Ayah", () => {
  const r = alignLive(ayah, say("الحمد لله رب العالمين الرحمن الرحيم"));
  assert.strictEqual(r.doneAt, 4);
  assert.deepStrictEqual(r.extra, ["الرحمن", "الرحيم"]);
});

test("waqf signs (no letters) are never compared", () => {
  const r = alignLive("فَإِنَّ مَعَ ٱلْعُسْرِ ۖ يُسْرًا", say("فان مع العسر يسرا"));
  assert.strictEqual(r.done, true);
  assert.strictEqual(r.words[3].status, "neutral");
});

test("finishing early marks the rest as not heard", () => {
  const fin = finalizeLive(alignLive(ayah, say("الحمد")));
  assert.deepStrictEqual(fin.words.map((w) => w.status), ["match", "missed", "missed", "missed"]);
  assert.strictEqual(fin.score, 25);
});
