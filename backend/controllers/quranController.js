const quranApi = require("../services/external/quranApi");
const TOPICS = require("../config/topics");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");

const wantsNativeText = (lang) => lang === "ur" || lang === "ar";

const getSurahs = asyncHandler(async (req, res) => {
  const surahs = await quranApi.getAllSurahs();
  return sendSuccess(res, { message: "Surah list", data: { surahs, total: surahs.length } });
});

const getSurah = asyncHandler(async (req, res) => {
  const { surahNumber } = req.params;
  const { translation } = req.query;

  const num = Number(surahNumber);
  if (!Number.isInteger(num) || num < 1 || num > 114) {
    const err = new Error("Surah number must be between 1 and 114");
    err.statusCode = 400;
    throw err;
  }

  const surah = await quranApi.getSurahDetail(num, translation || "en.sahih");
  return sendSuccess(res, { message: "Surah detail", data: { surah } });
});

const getReciters = asyncHandler(async (req, res) => {
  const reciters = await quranApi.getAvailableReciters();
  return sendSuccess(res, { message: "Available reciters", data: { reciters } });
});

const search = asyncHandler(async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) {
    const err = new Error("Search query must be at least 2 characters");
    err.statusCode = 400;
    throw err;
  }
  const results = await quranApi.searchQuran(q.trim());
  if (wantsNativeText(req.query.lang)) await quranApi.attachAyahTexts(results);
  return sendSuccess(res, { message: "Search results", data: { query: q, results } });
});

const getSurahAudio = asyncHandler(async (req, res) => {
  const num = Number(req.params.surahNumber);
  if (!Number.isInteger(num) || num < 1 || num > 114) {
    const err = new Error("Surah number must be between 1 and 114");
    err.statusCode = 400;
    throw err;
  }
  const reciter = req.query.reciter || "ar.alafasy";
  // Reciter ids look like "ar.alafasy" - reject anything else
  if (!/^[a-z]{2}\.[a-z0-9_.-]+$/i.test(reciter)) {
    const err = new Error("Invalid reciter identifier");
    err.statusCode = 400;
    throw err;
  }
  const audio = await quranApi.getSurahAudio(num, reciter);
  return sendSuccess(res, { message: "Surah audio", data: { audio } });
});

const getRange = asyncHandler(async (req, res) => {
  const { type, number } = req.params;
  const range = await quranApi.getRange(type, Number(number));
  return sendSuccess(res, { message: `Quran ${type} ${number}`, data: { range } });
});

const getSurahTajweed = asyncHandler(async (req, res) => {
  const num = Number(req.params.surahNumber);
  if (!Number.isInteger(num) || num < 1 || num > 114) {
    const err = new Error("Surah number must be between 1 and 114");
    err.statusCode = 400;
    throw err;
  }
  const tajweed = await quranApi.getSurahTajweed(num);
  return sendSuccess(res, { message: "Surah with Tajweed marks", data: { tajweed } });
});

const listTopics = asyncHandler(async (req, res) => {
  return sendSuccess(res, { message: "Quran topics", data: { topics: TOPICS.map(({ slug, label }) => ({ slug, label })) } });
});

// Runs every keyword of the topic and merges the distinct Ayahs
const getTopic = asyncHandler(async (req, res) => {
  const topic = TOPICS.find((t) => t.slug === req.params.slug);
  if (!topic) {
    const err = new Error("Unknown topic");
    err.statusCode = 404;
    throw err;
  }
  const settled = await Promise.allSettled(topic.keywords.map((k) => quranApi.searchQuran(k)));
  if (settled.every((r) => r.status === "rejected")) {
    const err = new Error("Quran search is temporarily unavailable");
    err.statusCode = 502;
    throw err;
  }
  const seen = new Set();
  const results = [];
  settled.forEach((r) => {
    if (r.status !== "fulfilled") return;
    r.value.forEach((m) => {
      const key = `${m.surahNumber}:${m.ayahNumber}`;
      if (!seen.has(key)) { seen.add(key); results.push(m); }
    });
  });
  const shown = results.slice(0, 40);
  // Urdu / Arabic readers get the Ayah in their own language (English readers skip the extra requests)
  if (wantsNativeText(req.query.lang)) await quranApi.attachAyahTexts(shown);
  return sendSuccess(res, {
    message: "Topic results",
    data: { topic: { slug: topic.slug, label: topic.label, keywords: topic.keywords }, total: results.length, results: shown },
  });
});

module.exports = { getSurahs, getSurah, getReciters, search, getSurahAudio, getRange, getSurahTajweed, listTopics, getTopic };
