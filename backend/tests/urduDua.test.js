// Phase 34 - Urdu Dua translation rules. No network: a fake http client is passed in.
const test = require("node:test");
const assert = require("node:assert");
const cache = require("../utils/cache");
const { splitText, translateToUrdu, attachUrdu } = require("../services/external/urduDua");
const { toApiShape } = require("../utils/duaImport");

const okHttp = (calls) => ({ get: async (_u, { params }) => { calls.push(params.q); return { data: { responseStatus: 200, responseData: { translatedText: "اے اللہ! مجھے معاف فرما" } } }; } });

test("splitText: short text stays whole, long text is cut under 450 characters", () => {
  assert.deepEqual(splitText("Forgive me."), ["Forgive me."]);
  assert.deepEqual(splitText("   "), []);
  const long = Array.from({ length: 40 }, (_, i) => `Sentence number ${i} is here.`).join(" ");
  const parts = splitText(long);
  assert.ok(parts.length > 1);
  parts.forEach((p) => assert.ok(p.length <= 450));
  assert.equal(parts.join(" "), long);
});

test("translateToUrdu: returns Urdu and caches it", async () => {
  cache.flushAll();
  const calls = [];
  const a = await translateToUrdu("O Allah, forgive me.", okHttp(calls));
  const b = await translateToUrdu("O Allah, forgive me.", okHttp(calls));
  assert.match(a, /[\u0600-\u06FF]/);
  assert.equal(a, b);
  assert.equal(calls.length, 1);
});

test("translateToUrdu: limit warnings, English echoes and network errors give null", async () => {
  cache.flushAll();
  const warn = { get: async () => ({ data: { responseStatus: 200, responseData: { translatedText: "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS" } } }) };
  const echo = { get: async () => ({ data: { responseStatus: 200, responseData: { translatedText: "Forgive me" } } }) };
  const down = { get: async () => { throw new Error("offline"); } };
  assert.equal(await translateToUrdu("Forgive me", warn), null);
  assert.equal(await translateToUrdu("Forgive me", echo), null);
  assert.equal(await translateToUrdu("Forgive me", down), null);
  assert.equal(await translateToUrdu("", okHttp([])), null);
});

test("attachUrdu: fills only Duas with English and no Urdu; typed Urdu is kept", async () => {
  cache.flushAll();
  const duas = [
    { slug: "a", en: { text: "Forgive me" } },
    { slug: "b", en: { text: "Guide me" }, ur: { text: "مجھے ہدایت دے" } },
    { slug: "c", ar: { text: "x" } },
  ];
  await attachUrdu(duas, okHttp([]));
  assert.equal(duas[0].ur.machine, true);
  assert.match(duas[0].ur.text, /[\u0600-\u06FF]/);
  assert.equal(duas[1].ur.text, "مجھے ہدایت دے");
  assert.equal(duas[2].ur, undefined);
  assert.equal(await attachUrdu(null), null);
});

test("toApiShape: carries the machine flag to the card", () => {
  assert.equal(toApiShape({ _id: "1", arabic: "ا", source: "s", urdu: "ا", urduMachine: true }).ur.machine, true);
  assert.equal(toApiShape({ _id: "1", arabic: "ا", source: "s", urdu: "ا" }).ur.machine, false);
});
