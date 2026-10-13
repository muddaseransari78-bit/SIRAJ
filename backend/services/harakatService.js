// Checks the harakat of one recorded Ayah. Kept free of Express/axios so it can be tested with plain Node:
// the two outside helpers (Quran text + pronunciation model) are passed in.
const httpError = require("../utils/httpError");
const { checkHarakat, stripBismillah } = require("../utils/harakat");

const MAX_AUDIO_BYTES = 4 * 1024 * 1024;

// Looks at the first bytes so random files are not forwarded to the model.
function looksLikeAudio(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return false;
  const head = buf.subarray(0, 4);
  if (head.equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return true; // webm / matroska
  if (head.toString("latin1") === "OggS") return true; // ogg
  if (head.toString("latin1") === "RIFF") return true; // wav
  if (buf.subarray(4, 8).toString("latin1") === "ftyp") return true; // mp4 / m4a
  if (head.toString("latin1") === "ID3" || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)) return true; // mp3
  return false;
}

async function checkAyahAudio({ surah, ayah, audio, contentType, partial = false }, { getSurahDetail, transcribe }) {
  if (!Number.isInteger(surah) || surah < 1 || surah > 114) throw httpError(400, "Invalid Surah number.");
  if (!Number.isInteger(ayah) || ayah < 1) throw httpError(400, "Invalid Ayah number.");
  if (!Buffer.isBuffer(audio) || audio.length === 0) throw httpError(400, "No audio was received.");
  if (audio.length > MAX_AUDIO_BYTES) throw httpError(413, "The recording is too large.");
  if (!looksLikeAudio(audio)) throw httpError(415, "That does not look like an audio recording.");

  const detail = await getSurahDetail(surah);
  const found = detail.ayahs.find((a) => a.numberInSurah === ayah);
  if (!found) throw httpError(404, "That Ayah does not exist.");
  const expected = stripBismillah(found.arabicText, surah, ayah);

  const { text } = await transcribe(audio, contentType);
  const result = checkHarakat(expected, text, { partial });
  return { surah, ayah, heardText: text, ...result };
}

module.exports = { checkAyahAudio, looksLikeAudio, MAX_AUDIO_BYTES };
