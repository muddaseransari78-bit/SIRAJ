const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const quranApi = require("../services/external/quranApi");
const pronunciation = require("../services/pronunciationService");
const { checkAyahAudio } = require("../services/harakatService");

// Lets the frontend know whether the zabar/zer/pesh check can be offered at all.
const harakatStatus = (req, res) => sendSuccess(res, { data: { enabled: pronunciation.isConfigured() } });

// POST /api/recitation/harakat?surah=1&ayah=2   body = raw audio of that Ayah
const harakatCheck = asyncHandler(async (req, res) => {
  const result = await checkAyahAudio(
    {
      surah: Number(req.query.surah),
      ayah: Number(req.query.ayah),
      audio: req.body, // a Buffer when the Content-Type was audio/*, otherwise {}
      contentType: req.headers["content-type"],
    },
    { getSurahDetail: (n) => quranApi.getSurahDetail(n), transcribe: pronunciation.transcribe }
  );
  return sendSuccess(res, { message: "Harakat check finished", data: { result } });
});

// POST /api/recitation/harakat/live?surah=1&ayah=2   body = the audio of this Ayah SO FAR (the recitation is still going on)
const harakatLive = asyncHandler(async (req, res) => {
  const result = await checkAyahAudio(
    {
      surah: Number(req.query.surah),
      ayah: Number(req.query.ayah),
      audio: req.body,
      contentType: req.headers["content-type"],
      partial: true,
    },
    { getSurahDetail: (n) => quranApi.getSurahDetail(n), transcribe: pronunciation.transcribe }
  );
  return sendSuccess(res, { message: "Live harakat check finished", data: { result } });
});

module.exports = { harakatStatus, harakatCheck, harakatLive };
