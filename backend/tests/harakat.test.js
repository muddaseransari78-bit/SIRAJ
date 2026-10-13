const test = require("node:test");
const assert = require("node:assert");
const { checkHarakat, compareWordMarks, stripBismillah, parseUnits } = require("../utils/harakat");
const { checkAyahAudio, looksLikeAudio } = require("../services/harakatService");

const AYAH2 = "ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَـٰلَمِينَ"; // Al-Fatihah 1:2 (Uthmani)
const AYAH1 = "بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ"; // Al-Fatihah 1:1

test("reads letters with their vowel and shadda", () => {
  const u = parseUnits("رَبِّ");
  assert.deepStrictEqual(u.map((x) => [x.letter, x.vowel, x.shadda]), [["ر", "fatha", false], ["ب", "kasra", true]]);
});

test("a correct recitation has no harakat mistakes", () => {
  const r = checkHarakat(AYAH2, "الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ");
  assert.strictEqual(r.available, true);
  assert.strictEqual(r.summary.wrong, 0);
  assert.strictEqual(r.summary.ok, 4);
  assert.strictEqual(r.summary.score, 100);
});

test("finds a wrong vowel inside a correct word (damma said as fatha)", () => {
  const r = checkHarakat(AYAH2, "الْحَمْدَ لِلَّهِ رَبِّ الْعَالَمِينَ");
  assert.strictEqual(r.words[0].status, "harakat");
  assert.deepStrictEqual(r.words[0].diffs.map((d) => [d.letter, d.expected, d.heard]), [["د", "damma", "fatha"]]);
  assert.strictEqual(r.summary.wrong, 1);
  assert.strictEqual(r.summary.score, 75);
});

test("finds a missing shadda", () => {
  const r = checkHarakat(AYAH2, "الْحَمْدُ لِلَهِ رَبِّ الْعَالَمِينَ");
  assert.strictEqual(r.words[1].status, "harakat");
  assert.strictEqual(r.words[1].diffs[0].kind, "shadda");
});

test("the vowel of the very last letter is ignored (reciter may stop there)", () => {
  const r = checkHarakat(AYAH2, "الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينِ");
  assert.strictEqual(r.words[3].status, "ok");
  assert.strictEqual(r.summary.wrong, 0);
});

test("a vowel change on the last letter of a middle word IS reported", () => {
  const r = checkHarakat(AYAH2, "الْحَمْدُ لِلَّهِ رَبَّ الْعَالَمِينَ");
  assert.strictEqual(r.words[2].status, "harakat");
});

test("plain letters (a model without harakat) are NOT treated as correct", () => {
  const r = checkHarakat(AYAH2, "الحمد لله رب العالمين");
  assert.strictEqual(r.available, false);
  assert.strictEqual(r.reason, "no-harakat");
});

test("empty result from the model", () => {
  const r = checkHarakat(AYAH2, "   ");
  assert.strictEqual(r.available, false);
  assert.strictEqual(r.reason, "nothing-heard");
});

test("a skipped word is reported as not heard, not as a harakat mistake", () => {
  const r = checkHarakat(AYAH2, "الْحَمْدُ رَبِّ الْعَالَمِينَ");
  assert.strictEqual(r.words[1].status, "notheard");
  assert.strictEqual(r.summary.notHeard, 1);
  assert.strictEqual(r.summary.wrong, 0);
});

test("a letter with no mark from the model is 'unclear', never a mistake", () => {
  const { diffs, unclear } = compareWordMarks("ٱلْحَمْدُ", "الْحَمْد");
  assert.strictEqual(diffs.length, 0);
  assert.strictEqual(unclear, 1);
});

test("removes the Bismillah from Ayah 1 only when it is really there", () => {
  const withBismillah = `${AYAH1} ٱلْحَمْدُ لِلَّهِ`;
  assert.strictEqual(stripBismillah(withBismillah, 2, 1), "ٱلْحَمْدُ لِلَّهِ");
  assert.strictEqual(stripBismillah(AYAH1, 1, 1), AYAH1);
  assert.strictEqual(stripBismillah(withBismillah, 2, 2), withBismillah);
});

// ---- service (outside helpers are stubbed) ----
const WEBM = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(64)]);
const deps = (heard) => ({
  getSurahDetail: async () => ({ ayahs: [{ numberInSurah: 1, arabicText: AYAH1 }, { numberInSurah: 2, arabicText: AYAH2 }] }),
  transcribe: async () => ({ text: heard }),
});

test("service: runs the whole check", async () => {
  const r = await checkAyahAudio({ surah: 1, ayah: 2, audio: WEBM, contentType: "audio/webm" }, deps("الْحَمْدَ لِلَّهِ رَبِّ الْعَالَمِينَ"));
  assert.strictEqual(r.ayah, 2);
  assert.strictEqual(r.summary.wrong, 1);
});

test("service: rejects bad input", async () => {
  const call = (p) => checkAyahAudio({ surah: 1, ayah: 2, audio: WEBM, contentType: "audio/webm", ...p }, deps("x"));
  await assert.rejects(call({ surah: 0 }), { statusCode: 400 });
  await assert.rejects(call({ ayah: 1.5 }), { statusCode: 400 });
  await assert.rejects(call({ audio: Buffer.alloc(0) }), { statusCode: 400 });
  await assert.rejects(call({ audio: Buffer.from("not audio at all, just text") }), { statusCode: 415 });
  await assert.rejects(call({ ayah: 9 }), { statusCode: 404 });
  assert.strictEqual(looksLikeAudio(WEBM), true);
});

// ---- LIVE mode (the recitation is still going on) ----
const AYAH3 = "ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ مَـٰلِكِ يَوْمِ ٱلدِّينِ"; // 4 words after the first two: used to test pending words

test("live: words not reached yet are 'pending', not 'not heard'", () => {
  // the reciter said two words; the last heard word is still being said, so it is not judged yet
  const r = checkHarakat(AYAH2, "الْحَمْدُ لِلَّهِ", { partial: true });
  assert.strictEqual(r.available, true);
  assert.strictEqual(r.partial, true);
  assert.deepStrictEqual(r.words.map((w) => w.status), ["ok", "pending", "pending", "pending"]);
  assert.strictEqual(r.summary.notHeard, 0);
  assert.strictEqual(r.summary.pending, 3);
});

test("live: a wrong vowel in a finished word is found while the recitation continues", () => {
  const r = checkHarakat(AYAH2, "الْحَمْدَ لِلَّهِ رَبِّ", { partial: true });
  assert.strictEqual(r.words[0].status, "harakat");
  assert.deepStrictEqual(r.words[0].diffs.map((d) => [d.letter, d.expected, d.heard]), [["د", "damma", "fatha"]]);
  assert.strictEqual(r.words[1].status, "ok");
  assert.strictEqual(r.words[2].status, "pending"); // heard but it is the last word: not judged yet
  assert.strictEqual(r.words[3].status, "pending");
});

test("live: one heard word only = nothing to judge yet (no error)", () => {
  const r = checkHarakat(AYAH2, "الْحَمْدَ", { partial: true });
  assert.strictEqual(r.available, true);
  assert.ok(r.words.filter((w) => w.status !== "neutral").every((w) => w.status === "pending"));
});

test("live: a skipped word in the middle IS 'not heard' (a later word was reached)", () => {
  const r = checkHarakat(AYAH2, "الْحَمْدُ رَبِّ الْعَالَمِينَ", { partial: true });
  assert.strictEqual(r.words[1].status, "notheard");
  assert.strictEqual(r.words[2].status, "ok");
  assert.strictEqual(r.words[3].status, "pending"); // الْعَالَمِينَ is the last heard word, still not judged
});

test("live: a model that writes plain letters is still reported, never guessed", () => {
  const r = checkHarakat(AYAH2, "الحمد لله رب", { partial: true });
  assert.strictEqual(r.available, false);
  assert.strictEqual(r.reason, "no-harakat");
});

test("full check is unchanged: summary has pending 0 and partial false", () => {
  const r = checkHarakat(AYAH2, "الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ");
  assert.strictEqual(r.partial, false);
  assert.strictEqual(r.summary.pending, 0);
  assert.strictEqual(r.summary.wrong, 0);
});

test("service: live mode through the same service", async () => {
  const r = await checkAyahAudio({ surah: 1, ayah: 2, audio: WEBM, contentType: "audio/webm", partial: true }, deps("الْحَمْدَ لِلَّهِ رَبِّ"));
  assert.strictEqual(r.partial, true);
  assert.strictEqual(r.summary.wrong, 1);
  assert.strictEqual(r.summary.pending, 2);
});

test("stopping on a word (sukun on its last letter) is not a mistake, a different vowel there still is", () => {
  const { compareWordMarks } = require("../utils/harakat");
  // "الرَّحْمَٰنِ" last letter has kasra; a reciter who stops says it with sukun
  const stopped = compareWordMarks("الرَّحِيمِ", "الرَّحِيمْ");
  assert.deepStrictEqual(stopped.diffs, []);
  const wrong = compareWordMarks("الرَّحِيمِ", "الرَّحِيمُ");
  assert.strictEqual(wrong.diffs.length, 1);
  assert.strictEqual(wrong.diffs[0].expected, "kasra");
  assert.strictEqual(wrong.diffs[0].heard, "damma");
  // a vowel mistake in the MIDDLE of a word is still caught
  const middle = compareWordMarks("الرَّحِيمِ", "الرَّحُيمِ");
  assert.strictEqual(middle.diffs.length, 1);
});
