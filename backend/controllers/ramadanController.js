const FastingLog = require("../models/FastingLog");
const hijriApi = require("../services/external/hijriApi");
const { getRamadanInfo } = require("../services/ramadanService");
const { parseTimesQuery } = require("./prayerController");
const asyncHandler = require("../utils/asyncHandler");
const httpError = require("../utils/httpError");
const { sendSuccess } = require("../utils/apiResponse");
const { parseDMY, todayDMY } = require("../utils/dates");
const ramadanDuas = require("../config/ramadanDuas");

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function bad(message) {
  return httpError(400, message);
}

// GET /api/ramadan/fasting?hijriYear=1448
// Returns the days the user marked as fasted in that Hijri year.
const getFasting = asyncHandler(async (req, res) => {
  const hijriYear = Number(req.query.hijriYear);
  if (!Number.isInteger(hijriYear) || hijriYear < 1300 || hijriYear > 1700) throw bad("Invalid hijriYear");
  const logs = await FastingLog.find({ user: req.user.id, hijriYear }).sort({ date: 1 });
  const ramadanDays = logs.filter((l) => l.hijriMonth === 9).map((l) => l.hijriDay);
  return sendSuccess(res, {
    message: "Fasting log",
    data: {
      hijriYear,
      ramadanDays, // e.g. [1,2,3,5] = Ramadan days marked as fasted
      ramadanCount: ramadanDays.length,
      otherCount: logs.length - ramadanDays.length, // voluntary / other fasts this Hijri year
      dates: logs.map((l) => l.date),
    },
  });
});

// POST /api/ramadan/fasting  { date, hijriYear, hijriMonth, hijriDay, fasted }
const setFasting = asyncHandler(async (req, res) => {
  const { date, hijriYear, hijriMonth, hijriDay, fasted = true } = req.body;
  if (!DATE_RE.test(date || "")) throw bad("date must be YYYY-MM-DD");
  if (!Number.isInteger(hijriYear) || hijriYear < 1300 || hijriYear > 1700) throw bad("Invalid hijriYear");
  if (!Number.isInteger(hijriMonth) || hijriMonth < 1 || hijriMonth > 12) throw bad("Invalid hijriMonth");
  if (!Number.isInteger(hijriDay) || hijriDay < 1 || hijriDay > 30) throw bad("Invalid hijriDay");

  if (fasted) {
    await FastingLog.findOneAndUpdate(
      { user: req.user.id, date },
      { $set: { hijriYear, hijriMonth, hijriDay } },
      { upsert: true, setDefaultsOnInsert: true }
    );
  } else {
    await FastingLog.deleteOne({ user: req.user.id, date });
  }
  return sendSuccess(res, { message: fasted ? "Marked as fasted" : "Fast removed", data: { date, fasted: !!fasted } });
});

// GET /api/ramadan/info?date=DD-MM-YYYY   (public)
// Next/current Ramadan: year, calculated first day, days until it starts.
const getInfo = asyncHandler(async (req, res) => {
  const date = req.query.date ? String(req.query.date) : todayDMY();
  if (!parseDMY(date)) throw bad("date must be DD-MM-YYYY");
  const data = await getRamadanInfo(date);
  return sendSuccess(res, { message: "Ramadan info", data });
});

// GET /api/ramadan/timetable?hijriYear=1448&lat=..&lng=..  (or city+country)&method=&school=&tune=   (public)
// Imsak / Fajr / Iftar (Maghrib) for all days of that Ramadan.
const getTimetable = asyncHandler(async (req, res) => {
  const hijriYear = Number(req.query.hijriYear);
  if (!Number.isInteger(hijriYear) || hijriYear < 1300 || hijriYear > 1700) throw bad("Invalid hijriYear");
  const place = parseTimesQuery(req.query); // same validation as the prayer times
  delete place.date; // a timetable always covers the whole month
  let data;
  try {
    data = await hijriApi.getRamadanTimetable({ hijriYear, ...place });
  } catch (e) {
    if (e.response && (e.response.status === 400 || e.response.status === 404)) {
      throw httpError(404, "Could not build the Ramadan timetable for that place. Check the city and country spelling.");
    }
    throw e;
  }
  return sendSuccess(res, { message: "Ramadan timetable", data });
});

// GET /api/ramadan/duas   (public) - Duas with their sources
const getDuas = asyncHandler(async (req, res) => sendSuccess(res, { message: "Ramadan duas", data: { duas: ramadanDuas } }));

module.exports = { getFasting, setFasting, getInfo, getTimetable, getDuas };
