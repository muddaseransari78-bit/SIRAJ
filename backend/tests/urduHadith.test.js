// Phase 33 - Urdu Hadith lookup rules. No network: a fake http client is passed in.
const test = require("node:test");
const assert = require("node:assert");
const cache = require("../utils/cache");
const { editionFor, numberOf, fetchOne, attachUrdu } = require("../services/external/urduHadith");

test("editionFor: finds the Urdu edition from the collection name", () => {
  assert.equal(editionFor("bukhari"), "urd-bukhari");
  assert.equal(editionFor("Sahih Muslim"), "urd-muslim");
  assert.equal(editionFor("abu-dawud"), "urd-abudawud");
  assert.equal(editionFor("ibnmajah"), "urd-ibnmajah");
  assert.equal(editionFor("nasai"), "urd-nasai");
  assert.equal(editionFor("malik"), null);
  assert.equal(editionFor(""), null);
});

test("numberOf: only plain whole numbers", () => {
  assert.equal(numberOf("12"), 12);
  assert.equal(numberOf(7), 7);
  assert.equal(numberOf("12a"), null);
  assert.equal(numberOf(""), null);
  assert.equal(numberOf(undefined), null);
});

test("attachUrdu adds ur.text, skips unknown collections, survives errors", async () => {
  cache.flushAll();
  const http = { get: async (url) => {
    if (url === "/urd-bukhari/1.json") return { data: { hadiths: [{ hadithnumber: 1, text: "اعمال کا دارومدار نیتوں پر ہے" }] } };
    const e = new Error("nope"); e.response = { status: 404 }; throw e;
  } };
  const list = [
    { collection: "bukhari", hadithNumber: "1" },
    { collection: "bukhari", hadithNumber: "2" },
    { collection: "malik", hadithNumber: "1" },
    { collection: "muslim", hadithNumber: "x" },
    { collection: "bukhari", hadithNumber: "3", ur: { text: "already" } },
  ];
  await attachUrdu(list, http);
  assert.equal(list[0].ur.text, "اعمال کا دارومدار نیتوں پر ہے");
  assert.equal(list[1].ur, undefined);
  assert.equal(list[2].ur, undefined);
  assert.equal(list[3].ur, undefined);
  assert.equal(list[4].ur.text, "already");
});

test("fetchOne remembers a missing Hadith but not a network failure", async () => {
  cache.flushAll();
  let calls = 0;
  const gone = { get: async () => { calls++; const e = new Error("x"); e.response = { status: 404 }; throw e; } };
  assert.equal(await fetchOne("bukhari", 5, gone), null);
  assert.equal(await fetchOne("bukhari", 5, gone), null);
  assert.equal(calls, 1);
  const down = { get: async () => { calls++; throw new Error("offline"); } };
  await fetchOne("bukhari", 6, down); await fetchOne("bukhari", 6, down);
  assert.equal(calls, 3);
});
