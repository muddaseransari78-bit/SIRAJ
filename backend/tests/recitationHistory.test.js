const test = require("node:test");
const assert = require("node:assert");
const { parseSession, summarize, perDay } = require("../utils/recitationHistory");

const NOW = "2026-10-03";
const code = (fn) => { try { fn(); return null; } catch (e) { return e.statusCode; } };
const good = { surahNumber: 1, date: NOW, ayahs: [{ ayahNumber: 1, score: 100, problems: 0 }, { ayahNumber: 2, score: 50, problems: 2 }] };

test("a valid session is cleaned and the average is worked out", () => {
  const s = parseSession({ ...good, extra: "ignored" }, NOW);
  assert.deepStrictEqual(s, { surahNumber: 1, date: NOW, ayahs: good.ayahs, averageScore: 75 });
});

test("date defaults to the server date and may be one day off (time zones)", () => {
  assert.strictEqual(parseSession({ ...good, date: undefined }, NOW).date, NOW);
  assert.strictEqual(parseSession({ ...good, date: "2026-10-04" }, NOW).date, "2026-10-04");
  assert.strictEqual(code(() => parseSession({ ...good, date: "2026-10-06" }, NOW)), 400);
  assert.strictEqual(code(() => parseSession({ ...good, date: "2026-02-30" }, NOW)), 400);
});

test("bad surah, bad ayah list and bad numbers are rejected", () => {
  assert.strictEqual(code(() => parseSession({ ...good, surahNumber: 0 }, NOW)), 400);
  assert.strictEqual(code(() => parseSession({ ...good, surahNumber: 115 }, NOW)), 400);
  assert.strictEqual(code(() => parseSession({ ...good, surahNumber: "1" }, NOW)), 400);
  assert.strictEqual(code(() => parseSession({ ...good, ayahs: [] }, NOW)), 400);
  assert.strictEqual(code(() => parseSession({ ...good, ayahs: "x" }, NOW)), 400);
  assert.strictEqual(code(() => parseSession({ ...good, ayahs: [{ ayahNumber: 1, score: 101, problems: 0 }] }, NOW)), 400);
  assert.strictEqual(code(() => parseSession({ ...good, ayahs: [{ ayahNumber: 1, score: 50.5, problems: 0 }] }, NOW)), 400);
  assert.strictEqual(code(() => parseSession({ ...good, ayahs: [{ ayahNumber: 0, score: 50, problems: 0 }] }, NOW)), 400);
  assert.strictEqual(code(() => parseSession({ ...good, ayahs: [null] }, NOW)), 400);
  assert.strictEqual(code(() => parseSession(null, NOW)), 400);
});

test("the same Ayah twice and too many Ayahs are rejected", () => {
  assert.strictEqual(code(() => parseSession({ ...good, ayahs: [good.ayahs[0], good.ayahs[0]] }, NOW)), 400);
  const many = Array.from({ length: 287 }, (_, i) => ({ ayahNumber: (i % 286) + 1, score: 1, problems: 0 }));
  assert.strictEqual(code(() => parseSession({ ...good, ayahs: many }, NOW)), 400);
});

test("summarize weights the average by the number of Ayahs", () => {
  const s = summarize([
    { ayahs: [1, 2, 3], averageScore: 100 },
    { ayahs: [1], averageScore: 0 },
  ]);
  assert.deepStrictEqual(s, { sessions: 2, ayahsPracticed: 4, averageScore: 75 });
  assert.deepStrictEqual(summarize([]), { sessions: 0, ayahsPracticed: 0, averageScore: 0 });
});

test("perDay fills empty days and adds up several sessions on one day", () => {
  const out = perDay([
    { date: "2026-10-03", ayahs: [1, 2] }, { date: "2026-10-03", ayahs: [1] }, { date: "2026-10-01", ayahs: [1] },
  ], "2026-10-03", 3);
  assert.deepStrictEqual(out, [
    { date: "2026-10-01", sessions: 1, ayahs: 1 }, { date: "2026-10-02", sessions: 0, ayahs: 0 }, { date: "2026-10-03", sessions: 2, ayahs: 3 },
  ]);
});
