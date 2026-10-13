import test from "node:test";
import assert from "node:assert";
import { detectAyahCandidates, MIN_WORDS } from "./ayahDetect.js";
import { splitWords } from "./recitationMatch.js";

// Al-Fatihah, plain text (with the Bismillah as Ayah 1)
const FATIHA = [
  [1, "بسم الله الرحمن الرحيم"], [2, "الحمد لله رب العالمين"], [3, "الرحمن الرحيم"], [4, "مالك يوم الدين"],
  [5, "اياك نعبد واياك نستعين"], [6, "اهدنا الصراط المستقيم"], [7, "صراط الذين انعمت عليهم غير المغضوب عليهم ولا الضالين"],
].map(([numberInSurah, text]) => ({ numberInSurah, text }));

const heard = (text) => splitWords(text);

test("finds the right Ayah from a few words", () => {
  const r = detectAyahCandidates(FATIHA, heard("مالك يوم الدين"));
  assert.strictEqual(r.candidates[0].ayahNumber, 4);
  assert.strictEqual(r.ambiguous, false);
  const r2 = detectAyahCandidates(FATIHA, heard("اهدنا الصراط المستقيم"));
  assert.strictEqual(r2.candidates[0].ayahNumber, 6);
  assert.strictEqual(r2.confidence, "high");
});

test("works when only the start of a longer Ayah was heard", () => {
  const r = detectAyahCandidates(FATIHA, heard("صراط الذين انعمت عليهم"));
  assert.strictEqual(r.candidates[0].ayahNumber, 7);
});

test("a small speech-recogniser slip still finds the Ayah", () => {
  const r = detectAyahCandidates(FATIHA, heard("اياك نعبد واياك نستعن"));
  assert.strictEqual(r.candidates[0].ayahNumber, 5);
});

test("too few words, unknown words and empty input give no answer", () => {
  assert.strictEqual(MIN_WORDS, 3);
  assert.strictEqual(detectAyahCandidates(FATIHA, heard("مالك يوم")), null);
  assert.strictEqual(detectAyahCandidates(FATIHA, heard("كلام غير معروف تماما ابدا")), null);
  assert.strictEqual(detectAyahCandidates(FATIHA, []), null);
  assert.strictEqual(detectAyahCandidates([], heard("مالك يوم الدين")), null);
  assert.strictEqual(detectAyahCandidates(FATIHA, undefined), null);
});

test("a repeated refrain is reported as ambiguous with both Ayahs listed", () => {
  const refrain = "فباي الاء ربكما تكذبان";
  const list = [
    { numberInSurah: 13, text: refrain }, { numberInSurah: 14, text: "خلق الانسان من صلصال كالفخار" },
    { numberInSurah: 16, text: refrain }, { numberInSurah: 17, text: "رب المشرقين ورب المغربين" },
  ];
  const r = detectAyahCandidates(list, heard(refrain));
  assert.strictEqual(r.ambiguous, true);
  assert.notStrictEqual(r.confidence, "high");
  assert.deepStrictEqual(r.candidates.slice(0, 2).map((c) => c.ayahNumber).sort((a, b) => a - b), [13, 16]);
});

test("at most 3 candidates, best first", () => {
  const r = detectAyahCandidates(FATIHA, heard("الرحمن الرحيم مالك يوم الدين"));
  assert.ok(r.candidates.length <= 3);
  assert.ok(r.candidates.every((c, i, a) => i === 0 || a[i - 1].rank >= c.rank));
});
