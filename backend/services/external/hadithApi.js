const axios = require("axios");
const cache = require("../../utils/cache");
const { CACHE_TTL_SECONDS } = require("../../config/constants");

const BASE_URL = process.env.ISLAMIC_API_BASE_URL || "https://api.islamic.app";
const { makeIslamicClient } = require("../../utils/islamicClient");
const client = makeIslamicClient(10000);

/**
 * Unwraps the { code, status, data } envelope every islamic.app response uses.
 */
function unwrap(response) {
  return response.data.data;
}

/**
 * Lists all Hadith collections (Bukhari, Muslim, Abu Dawud, etc.)
 * Cached 24h since this list is effectively static.
 */
async function getCollections() {
  const cacheKey = "hadith:collections";
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const response = await client.get("/v1/hadith/collections", { params: { type: "hadith" } });
  const collections = unwrap(response);

  cache.set(cacheKey, collections, CACHE_TTL_SECONDS.QURAN_STATIC);
  return collections;
}

/**
 * Lists the books within one Hadith collection (e.g. "bukhari").
 */
async function getBooks(collectionSlug) {
  const cacheKey = `hadith:books:${collectionSlug}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const response = await client.get(`/v1/hadith/collections/${collectionSlug}/books`);
  const books = unwrap(response);

  cache.set(cacheKey, books, CACHE_TTL_SECONDS.QURAN_STATIC);
  return books;
}

/**
 * Lists Hadiths within one book of a collection, paginated.
 * Always preserves collection/book/hadith number as the source reference.
 */
async function getHadithsInBook(collectionSlug, bookNumber, { limit = 20, offset = 0 } = {}) {
  const response = await client.get(
    `/v1/hadith/collections/${collectionSlug}/books/${bookNumber}/hadiths`,
    { params: { limit, offset } }
  );
  return unwrap(response);
}

/**
 * Fetches a single Hadith by its collection/book/number reference.
 */
async function getHadith(collectionSlug, bookNumber, hadithNumber) {
  const response = await client.get(
    `/v1/hadith/collections/${collectionSlug}/books/${bookNumber}/hadiths/${hadithNumber}`
  );
  return unwrap(response);
}

/**
 * Full-text search across the Hadith corpus.
 */
async function searchHadiths(query, { collection, limit = 20 } = {}) {
  // The same search is often repeated (retry, back button, filters): keep the answer for 10 minutes.
  const cacheKey = `hadith:search:${String(query).toLowerCase()}:${collection || ""}:${limit}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const params = { q: query, limit };
  if (collection) params.collection = collection;
  const response = await client.get("/v1/hadith/search", { params });
  const result = unwrap(response);
  cache.set(cacheKey, result, 600);
  return result;
}

/**
 * A deterministic "Hadith of the Day" - same result for every caller
 * on a given UTC date, used on the SIRAJ home page.
 */
async function getHadithOfTheDay() {
  const cacheKey = `hadith:today:${new Date().toISOString().slice(0, 10)}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const response = await client.get("/v1/hadith/today");
  const hadith = unwrap(response);

  cache.set(cacheKey, hadith, CACHE_TTL_SECONDS.PRAYER_TIMES);
  return hadith;
}

module.exports = { getCollections, getBooks, getHadithsInBook, getHadith, searchHadiths, getHadithOfTheDay };
