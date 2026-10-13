const hijriApi = require("../services/external/hijriApi");
const calendarService = require("../services/calendarService");
const asyncHandler = require("../utils/asyncHandler");
const httpError = require("../utils/httpError");
const { sendSuccess } = require("../utils/apiResponse");
const { parseDMY, parseHijriDMY, todayDMY } = require("../utils/dates");

// GET /api/calendar/convert?gregorian=DD-MM-YYYY   or   ?hijri=DD-MM-YYYY
const convert = asyncHandler(async (req, res) => {
  const { gregorian, hijri } = req.query;
  if (!gregorian === !hijri) throw httpError(400, "Send either gregorian=DD-MM-YYYY or hijri=DD-MM-YYYY");

  let data;
  if (gregorian) {
    const p = parseDMY(gregorian);
    if (!p || p.y < 1900 || p.y > 2100) throw httpError(400, "gregorian must be a real date (DD-MM-YYYY) between 1900 and 2100");
    data = await hijriApi.gregorianToHijri(String(gregorian));
  } else {
    if (!parseHijriDMY(hijri)) throw httpError(400, "hijri must be DD-MM-YYYY (day 1-30, month 1-12, year 1300-1700)");
    try {
      data = await hijriApi.hijriToGregorian(String(hijri));
    } catch (e) {
      // e.g. day 30 in a 29-day month: the calendar service refuses it
      if (e.response && (e.response.status === 400 || e.response.status === 404)) {
        throw httpError(400, "That Hijri date does not exist. Check the day (some months have only 29 days).");
      }
      throw e;
    }
  }
  return sendSuccess(res, { message: "Date converted", data: { ...data, note: "Calculated date. The real start of a Hijri month depends on moon sighting." } });
});

// GET /api/calendar/upcoming?date=DD-MM-YYYY&limit=8
const upcoming = asyncHandler(async (req, res) => {
  const date = req.query.date ? String(req.query.date) : todayDMY();
  if (!parseDMY(date)) throw httpError(400, "date must be DD-MM-YYYY");
  let limit = 8;
  if (req.query.limit !== undefined && req.query.limit !== "") {
    limit = Number(req.query.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 12) throw httpError(400, "limit must be 1-12");
  }
  const data = await calendarService.getUpcomingEvents(date, limit);
  return sendSuccess(res, { message: "Upcoming Islamic dates", data });
});

module.exports = { convert, upcoming };
