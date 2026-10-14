const axios = require("axios");
const cache = require("../../utils/cache");
const { CACHE_TTL_SECONDS } = require("../../config/constants");

const BASE_URL = process.env.ISLAMIC_API_BASE_URL || "https://api.islamic.app";
const { makeIslamicClient } = require("../../utils/islamicClient");
const client = makeIslamicClient(10000);

const unwrap = (r) => r.data.data;

// Named shortcuts supported by the source API (Hisn al-Muslim)
const DUA_SHORTCUTS = [
  "morning", "evening", "after-prayer", "before-sleep", "waking-up", "prayer",
  "mosque", "travel", "food", "home", "anxiety", "protection", "forgiveness", "hajj",
];

async function getDuasByCategory(category) {
  const cacheKey = `dua:${category}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const response = await client.get(`/v1/dhikr/${encodeURIComponent(category)}`);
  const data = unwrap(response);

  cache.set(cacheKey, data, CACHE_TTL_SECONDS.QURAN_STATIC);
  return data;
}

async function getDuaCategories() {
  const cacheKey = "dua:categories";
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const response = await client.get("/v1/dhikr");
  const data = unwrap(response);

  cache.set(cacheKey, data, CACHE_TTL_SECONDS.QURAN_STATIC);
  return data;
}

async function getQiblaDirection(latitude, longitude) {
  const response = await client.get(`/v1/qibla/${latitude}/${longitude}`);
  return unwrap(response);
}

module.exports = { DUA_SHORTCUTS, getDuasByCategory, getDuaCategories, getQiblaDirection };
