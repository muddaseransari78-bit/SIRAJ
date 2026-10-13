const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const tafsirApi = require("../services/external/tafsirApi");
const calendarService = require("../services/calendarService");
const Announcement = require("../models/Announcement");
const Reminder = require("../models/Reminder");
const calendarController = require("../controllers/calendarController");

const badRequest = (msg) => Object.assign(new Error(msg), { statusCode: 400 });

// ---------- TAFSEER ----------
const tafseerRouter = express.Router();
tafseerRouter.get("/sources", asyncHandler(async (req, res) => {
  const sources = await tafsirApi.getTafsirSources();
  return sendSuccess(res, { message: "Tafseer sources", data: { sources } });
}));
tafseerRouter.get("/:surah/:ayah", asyncHandler(async (req, res) => {
  const surah = Number(req.params.surah);
  const ayah = Number(req.params.ayah);
  if (!Number.isInteger(surah) || surah < 1 || surah > 114) throw badRequest("Surah must be 1-114");
  if (!Number.isInteger(ayah) || ayah < 1) throw badRequest("Invalid ayah number");
  const source = (req.query.source || "ar-tafsir-ibn-kathir").toString();
  const data = await tafsirApi.getTafsirForVerse(surah, ayah, source);
  return sendSuccess(res, { message: "Tafseer", data });
}));

// ---------- CALENDAR ----------
const calendarRouter = express.Router();
calendarRouter.get("/", asyncHandler(async (req, res) => {
  const now = new Date();
  const month = Number(req.query.month) || now.getMonth() + 1;
  const year = Number(req.query.year) || now.getFullYear();
  if (month < 1 || month > 12 || year < 1900 || year > 2100) throw badRequest("Invalid month/year");
  const days = await calendarService.getMonth(month, year);
  return sendSuccess(res, { message: "Islamic calendar", data: { month, year, days } });
}));
calendarRouter.get("/convert", calendarController.convert);
calendarRouter.get("/upcoming", calendarController.upcoming);

// ---------- PUBLIC ANNOUNCEMENTS ----------
const announcementRouter = express.Router();
announcementRouter.get("/", asyncHandler(async (req, res) => {
  const items = await Announcement.find({ isActive: true }).sort({ createdAt: -1 }).limit(3);
  return sendSuccess(res, { message: "Announcements", data: { announcements: items } });
}));

// ---------- DAILY REMINDER (admin-managed) ----------
const reminderRouter = express.Router();
reminderRouter.get("/today", asyncHandler(async (req, res) => {
  const items = await Reminder.find({ isActive: true }).sort({ _id: 1 }).select("text source");
  if (items.length === 0) return sendSuccess(res, { message: "No reminder", data: { reminder: null } });
  const dayNumber = Math.floor(Date.now() / 86400000); // same reminder for everyone all day
  return sendSuccess(res, { message: "Reminder of the day", data: { reminder: items[dayNumber % items.length] } });
}));

module.exports = { tafseerRouter, calendarRouter, announcementRouter, reminderRouter };
