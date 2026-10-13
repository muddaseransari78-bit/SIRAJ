const prayerApi = require("../services/external/prayerApi");
const asyncHandler = require("../utils/asyncHandler");
const httpError = require("../utils/httpError");
const { sendSuccess } = require("../utils/apiResponse");

const DATE_RE = /^(\d{2})-(\d{2})-(\d{4})$/; // DD-MM-YYYY

// Pure validation so it can be unit-tested without a server.
function parseTimesQuery(query) {
  const { lat, lng, city, country, method, school, date, tune } = query;
  const out = {};

  if (city) {
    const c = String(city).trim();
    const k = String(country || "").trim();
    if (!c || c.length > 80 || !k || k.length > 80) throw httpError(400, "city and country are required (max 80 characters)");
    out.city = c;
    out.country = k;
  } else {
    const latitude = Number(lat);
    const longitude = Number(lng);
    if (lat === undefined || lng === undefined || lat === "" || lng === "") {
      throw httpError(400, "Send lat and lng, or city and country");
    }
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      throw httpError(400, "lat must be -90..90 and lng must be -180..180");
    }
    out.latitude = latitude;
    out.longitude = longitude;
  }

  if (method !== undefined && method !== "") {
    const m = Number(method);
    if (!Number.isInteger(m) || m < 0 || m > 99) throw httpError(400, "Invalid calculation method");
    out.method = m;
  }
  if (school !== undefined && school !== "") {
    const s = Number(school);
    if (s !== 0 && s !== 1) throw httpError(400, "school must be 0 (Shafi) or 1 (Hanafi)");
    out.school = s;
  }
  if (date !== undefined && date !== "") {
    const m = DATE_RE.exec(String(date));
    const d = m && new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
    if (!m || d.getUTCDate() !== +m[1] || d.getUTCMonth() !== +m[2] - 1) throw httpError(400, "date must be DD-MM-YYYY");
    out.date = String(date);
  }
  if (tune !== undefined && tune !== "") {
    const t = prayerApi.normalizeTune(tune);
    if (t === null) throw httpError(400, "tune must be whole minutes between -30 and 30");
    out.tune = t;
  }
  return out;
}

const getTimes = asyncHandler(async (req, res) => {
  const options = parseTimesQuery(req.query);
  let result;
  try {
    result = await prayerApi.getPrayerTimes(options);
  } catch (e) {
    // Unknown city -> AlAdhan answers 400/404: show a friendly 404 instead of a server error
    if (e.response && (e.response.status === 400 || e.response.status === 404)) {
      throw httpError(404, "Could not find prayer times for that place. Check the city and country spelling.");
    }
    throw e;
  }
  return sendSuccess(res, { message: "Prayer times", data: result });
});

module.exports = { getTimes, parseTimesQuery };
