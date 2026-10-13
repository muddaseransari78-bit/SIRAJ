import test from "node:test";
import assert from "node:assert";
import { audioList, audioUrlForAyah } from "./ayahAudio.js";

const server = { surahNumber: 1, reciter: "ar.alafasy", ayahs: [{ numberInSurah: 1, audio: "https://cdn.example/1.mp3" }, { numberInSurah: 2, audio: "http://cdn.example/2.mp3" }] };

test("reads the object the server really sends (this was the bug)", () => {
  assert.strictEqual(audioUrlForAyah(server, 1), "https://cdn.example/1.mp3");
});
test("a plain list still works", () => {
  assert.strictEqual(audioUrlForAyah(server.ayahs, 1), "https://cdn.example/1.mp3");
});
test("http links are upgraded to https", () => {
  assert.strictEqual(audioUrlForAyah(server, 2), "https://cdn.example/2.mp3");
});
test("missing Ayah, empty or broken data give an empty string and never throw", () => {
  assert.strictEqual(audioUrlForAyah(server, 9), "");
  assert.strictEqual(audioUrlForAyah(null, 1), "");
  assert.strictEqual(audioUrlForAyah({}, 1), "");
  assert.strictEqual(audioUrlForAyah({ ayahs: [{ numberInSurah: 1 }] }, 1), "");
  assert.deepStrictEqual(audioList(undefined), []);
});
test("the Ayah number may come as a string", () => {
  assert.strictEqual(audioUrlForAyah(server, "1"), "https://cdn.example/1.mp3");
});
