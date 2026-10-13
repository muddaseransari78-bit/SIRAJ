// Sends one Ayah recording to YOUR pronunciation service and gets back the text it heard.
// The service is not part of the Node backend: see ../../pronunciation-service/README.md.
//
// Contract:  POST {PRONUNCIATION_API_URL}/transcribe
//            body = the raw audio, Content-Type = the audio type (e.g. audio/webm)
//            optional header  Authorization: Bearer {PRONUNCIATION_API_KEY}
//            reply = JSON { "text": "<Arabic WITH harakat>" }
const axios = require("axios");
const httpError = require("../utils/httpError");

function isConfigured() {
  return Boolean(process.env.PRONUNCIATION_API_URL);
}

async function transcribe(audio, contentType) {
  if (!isConfigured()) {
    throw httpError(503, "Harakat checking is not set up on this server.");
  }
  const url = `${process.env.PRONUNCIATION_API_URL.replace(/\/+$/, "")}/transcribe`;
  const headers = { "Content-Type": contentType || "application/octet-stream" };
  if (process.env.PRONUNCIATION_API_KEY) headers.Authorization = `Bearer ${process.env.PRONUNCIATION_API_KEY}`;

  let data;
  try {
    ({ data } = await axios.post(url, audio, {
      headers,
      timeout: Number(process.env.PRONUNCIATION_TIMEOUT_MS) || 60000,
      maxBodyLength: 8 * 1024 * 1024,
    }));
  } catch (err) {
    throw httpError(502, "The pronunciation service could not be reached or failed. Please try again later.");
  }
  if (!data || typeof data.text !== "string") {
    throw httpError(502, "The pronunciation service sent an unexpected reply.");
  }
  return { text: data.text };
}

module.exports = { isConfigured, transcribe };
