const searchService = require("../services/searchService");
const quranApi = require("../services/external/quranApi");
const M = require("../utils/searchMath");
const { SEARCH_TYPES } = require("../config/searchIndex");
const cache = require("../utils/cache");
const asyncHandler = require("../utils/asyncHandler");
const httpError = require("../utils/httpError");
const { sendSuccess } = require("../utils/apiResponse");

const SEARCH_CACHE_SECONDS = 10 * 60; // the sources rarely change; 10 minutes keeps the external APIs calm

// query strings can be arrays (?q=a&q=b) - only a single string is accepted
function readQuery(req, min) {
  const raw = req.query.q;
  if (typeof raw !== "string") throw httpError(400, "Search query is required");
  const q = raw.replace(/\s+/g, " ").trim();
  if (q.length < min) throw httpError(400, min > 1 ? `Search query must be at least ${min} characters` : "Search query is required");
  if (q.length > 100) throw httpError(400, "Search query is too long");
  return q;
}

// GET /api/search?q=patience&types=quran,hadith&limit=30
const globalSearch = asyncHandler(async (req, res) => {
  const q = readQuery(req, 2);
  const types = M.parseTypes(req.query.types, SEARCH_TYPES);
  if (types.length === 0) throw httpError(400, `types must be a comma list of: ${SEARCH_TYPES.join(", ")}`);
  const limit = M.clampInt(req.query.limit, 1, 50, 15);

  // Urdu / Arabic readers also get each Ayah in their own language (cached separately)
  const lang = req.query.lang === "ur" || req.query.lang === "ar" ? req.query.lang : "en";
  const key = `search:v2:${lang}:${q.toLowerCase()}:${[...types].sort().join(",")}:${limit}`;
  const cached = cache.get(key);
  if (cached) return sendSuccess(res, { message: "Search results", data: cached });

  const data = await searchService.search(q, { types, limit });
  if (lang !== "en" && Array.isArray(data.quran) && data.quran.length) {
    try { await quranApi.attachAyahTexts(data.quran); } catch (e) { /* the English text is still shown */ }
  }
  // Never cache a partial answer: a source that was down a moment ago may be back now.
  if (!Object.values(data.errors).some(Boolean)) cache.set(key, data, SEARCH_CACHE_SECONDS);
  return sendSuccess(res, { message: "Search results", data });
});

// GET /api/search/suggest?q=baq  (fast, local/cached data only)
const suggest = asyncHandler(async (req, res) => {
  const q = readQuery(req, 1);
  const data = await searchService.suggest(q);
  res.set("Cache-Control", "public, max-age=60");
  return sendSuccess(res, { message: "Search suggestions", data });
});

module.exports = { globalSearch, suggest, readQuery };
