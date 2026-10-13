const urduHadith = require("../services/external/urduHadith");
const hadithApi = require("../services/external/hadithApi");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");

const getCollections = asyncHandler(async (req, res) => {
  const collections = await hadithApi.getCollections();
  return sendSuccess(res, { message: "Hadith collections", data: { collections } });
});

const getBooks = asyncHandler(async (req, res) => {
  const books = await hadithApi.getBooks(req.params.collection);
  return sendSuccess(res, { message: "Books", data: { collection: req.params.collection, books } });
});

const getHadiths = asyncHandler(async (req, res) => {
  const { collection, bookNumber } = req.params;
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const offset = Number(req.query.offset) || 0;
  const result = await hadithApi.getHadithsInBook(collection, bookNumber, { limit, offset });
  await urduHadith.attachUrdu(result?.hadiths);
  return sendSuccess(res, { message: "Hadiths", data: result });
});

const getHadith = asyncHandler(async (req, res) => {
  const { collection, bookNumber, hadithNumber } = req.params;
  const hadith = await hadithApi.getHadith(collection, bookNumber, hadithNumber);
  await urduHadith.attachUrdu([hadith]);
  return sendSuccess(res, { message: "Hadith", data: { hadith } });
});

const search = asyncHandler(async (req, res) => {
  const { q, collection } = req.query;
  if (!q || q.trim().length < 2) {
    const err = new Error("Search query must be at least 2 characters");
    err.statusCode = 400;
    throw err;
  }
  const result = await hadithApi.searchHadiths(q.trim(), { collection });
  await urduHadith.attachUrdu(result?.hadiths || result?.results);
  return sendSuccess(res, { message: "Hadith search results", data: result });
});

const today = asyncHandler(async (req, res) => {
  const hadith = await hadithApi.getHadithOfTheDay();
  await urduHadith.attachUrdu([hadith]);
  return sendSuccess(res, { message: "Hadith of the day", data: { hadith } });
});

module.exports = { getCollections, getBooks, getHadiths, getHadith, search, today };
