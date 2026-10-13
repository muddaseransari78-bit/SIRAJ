const api = require("../services/external/duaQiblaApi");
const urduDua = require("../services/external/urduDua");
const Dua = require("../models/Dua");
const { toApiShape } = require("../utils/duaImport");
const asyncHandler = require("../utils/asyncHandler");
const httpError = require("../utils/httpError");
const geocodeApi = require("../services/external/geocodeApi");
const { qiblaBearing, distanceToKaabaKm, KAABA } = require("../utils/qibla");
const { sendSuccess } = require("../utils/apiResponse");

// ---- DUAS ----
const getCategories = asyncHandler(async (req, res) => {
  let categories = null;
  try {
    categories = await api.getDuaCategories();
  } catch (e) {
    // Fall back gracefully: the named shortcuts always work
    categories = null;
  }
  // Categories that only exist because an admin added Duas to them
  let customCategories = [];
  try {
    const used = await Dua.distinct("category", { isActive: true });
    customCategories = used.filter((c) => !api.DUA_SHORTCUTS.includes(c)).sort();
  } catch (e) { /* database problem must not break the Dua list */ }
  return sendSuccess(res, {
    message: "Dua categories",
    data: { shortcuts: api.DUA_SHORTCUTS, categories, customCategories },
  });
});

// Duas stored in SIRAJ's own database (admin-written, starter and imported), shaped like the external ones
// Stored Duas that have English but no Urdu get a machine translation, saved once so it never repeats.
// `urdu: ""` in the filter means a text typed meanwhile by an admin is never overwritten.
async function fillMissingUrdu(rows) {
  const todo = rows.filter((r) => !String(r.urdu || "").trim() && String(r.english || "").trim());
  for (let i = 0; i < todo.length; i += 4) {
    const chunk = todo.slice(i, i + 4);
    const texts = await Promise.all(chunk.map((r) => urduDua.translateToUrdu(r.english).catch(() => null)));
    await Promise.all(chunk.map(async (r, j) => {
      if (!texts[j]) return;
      r.urdu = texts[j];
      r.urduMachine = true;
      try { await Dua.updateOne({ _id: r._id, urdu: "" }, { $set: { urdu: texts[j], urduMachine: true } }); } catch (e) { /* shown anyway, saved next time */ }
    }));
  }
}

async function customDuasFor(category) {
  try {
    const rows = await Dua.find({ category, isActive: true }).sort({ createdAt: 1 });
    await fillMissingUrdu(rows);
    return rows.map(toApiShape);
  } catch (e) {
    return [];
  }
}

// True when this category was already copied from Hisn al-Muslim into our database (then no outside call is needed)
async function hasImportedDuas(category) {
  try {
    return (await Dua.countDocuments({ category, isActive: true, origin: "import" })) > 0;
  } catch (e) {
    return false;
  }
}

const getDuas = asyncHandler(async (req, res) => {
  const category = String(req.params.category || "").toLowerCase();
  if (!/^[a-z0-9-]{2,40}$/.test(category)) {
    const err = new Error("Invalid category");
    err.statusCode = 400;
    throw err;
  }
  const custom = await customDuasFor(category);
  let data = null;
  try {
    // Database first: if the Hisn al-Muslim Duas of this category are already stored, skip the outside website.
    if (await hasImportedDuas(category)) {
      data = { label: category.replace(/-/g, " "), duas: [] };
    } else {
      data = await api.getDuasByCategory(category);
    }
  } catch (e) {
    // Not a Hisn al-Muslim category: fine if an admin created it, otherwise report the failure
    if (custom.length === 0) throw e;
    data = { label: category.replace(/-/g, " "), duas: [] };
  }
  await urduDua.attachUrdu(data?.duas); // Duas straight from the outside API (no Urdu there)
  return sendSuccess(res, { message: "Duas", data: { ...data, customDuas: custom } });
});

// ---- QIBLA ----
// Pure validation, so it can be unit-tested without a server
function parseCoords(query) {
  const { lat, lng } = query;
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (lat === undefined || lng === undefined || lat === "" || lng === "" ||
      !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw httpError(400, "Valid lat (-90..90) and lng (-180..180) are required");
  }
  return { latitude, longitude };
}

// Calculated here with the great-circle formula - no outside service needed.
const getQibla = asyncHandler(async (req, res) => {
  const { latitude, longitude } = parseCoords(req.query);
  const direction = qiblaBearing(latitude, longitude);
  const distanceKm = distanceToKaabaKm(latitude, longitude);
  return sendSuccess(res, {
    message: "Qibla direction",
    data: {
      direction: Math.round(direction * 100) / 100, // degrees clockwise from TRUE north
      distanceKm: Math.round(distanceKm),
      kaaba: KAABA,
      method: "Great-circle (initial bearing) to the Kaaba",
    },
  });
});

// City name -> coordinates (manual location fallback)
const searchPlace = asyncHandler(async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (q.length < 2 || q.length > 80) throw httpError(400, "Type 2 to 80 characters of a city name");
  let places;
  try {
    places = await geocodeApi.searchPlaces(q);
  } catch (e) {
    throw httpError(502, "The place search service is not reachable right now. Enter latitude and longitude instead.");
  }
  return sendSuccess(res, { message: "Places", data: { places } });
});

module.exports = { getCategories, getDuas, getQibla, searchPlace, parseCoords, fillMissingUrdu };
