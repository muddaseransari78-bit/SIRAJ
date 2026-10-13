const Goal = require("../models/Goal");
const Notification = require("../models/Notification");
const TasbeehSession = require("../models/TasbeehSession");
const PrayerLog = require("../models/PrayerLog");
const ReadingActivity = require("../models/ReadingActivity");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");

const { GOAL_TYPES } = Goal;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Sensible maximums per goal type
const MAX_TARGET = { TASBEEH_DAILY: 100000, PRAYERS_DAILY: 5, READING_DAYS_WEEKLY: 7 };

const LABELS = {
  TASBEEH_DAILY: "Daily Tasbeeh goal",
  PRAYERS_DAILY: "Daily prayers goal",
  READING_DAYS_WEEKLY: "Weekly Quran reading days goal",
};

function bad(message) {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
}

// "2026-09-30" minus n days -> "2026-09-23" (pure date maths, no time zone surprises)
function shiftDate(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Reads ?today=YYYY-MM-DD&tz=<minutes from Date.getTimezoneOffset()>
function readDay(query) {
  const today = query.today || new Date().toISOString().slice(0, 10);
  if (!DATE_RE.test(today)) throw bad("today must be YYYY-MM-DD");
  const tz = Number(query.tz || 0);
  if (!Number.isFinite(tz) || Math.abs(tz) > 900) throw bad("Invalid tz");
  return { today, tz };
}

async function progressFor(userId, type, { today, tz }) {
  if (type === "TASBEEH_DAILY") {
    // Local midnight expressed in UTC, so "today" matches the user's own day
    const start = new Date(new Date(`${today}T00:00:00Z`).getTime() + tz * 60000);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    const rows = await TasbeehSession.aggregate([
      { $match: { user: new (require("mongoose").Types.ObjectId)(userId), createdAt: { $gte: start, $lt: end } } },
      { $group: { _id: null, total: { $sum: "$count" } } },
    ]);
    return rows[0]?.total || 0;
  }
  if (type === "PRAYERS_DAILY") {
    return PrayerLog.countDocuments({ user: userId, date: today, completed: true });
  }
  // READING_DAYS_WEEKLY: number of days with reading activity in the last 7 days (incl. today)
  return ReadingActivity.countDocuments({ user: userId, date: { $gte: shiftDate(today, -6), $lte: today } });
}

async function notifyIfReached(userId, type, current, target, today) {
  if (current < target) return;
  try {
    await Notification.updateOne(
      { user: userId, key: `goal:${type}:${today}` },
      {
        $setOnInsert: {
          user: userId, type: "GOAL", key: `goal:${type}:${today}`,
          title: "Goal reached 🎉",
          body: `${LABELS[type]} completed. May Allah accept it from you.`,
          link: "/goals",
        },
      },
      { upsert: true }
    );
  } catch (e) {
    // A duplicate-key race just means it was already created - ignore.
  }
}

// Every goal of a user with its live progress (also used by the dashboard summary)
async function goalItems(userId, day) {
  const goals = await Goal.find({ user: userId });
  return Promise.all(
    goals.map(async (g) => {
      const current = await progressFor(userId, g.type, day);
      await notifyIfReached(userId, g.type, current, g.target, day.today);
      return { type: g.type, label: LABELS[g.type], target: g.target, current, done: current >= g.target };
    })
  );
}

// GET /api/goals
const listGoals = asyncHandler(async (req, res) => {
  const day = readDay(req.query);
  const items = await goalItems(req.user.id, day);
  return sendSuccess(res, { message: "Goals", data: { goals: items, availableTypes: GOAL_TYPES.map((t) => ({ type: t, label: LABELS[t], max: MAX_TARGET[t] })) } });
});

// PUT /api/goals/:type  { target }
const setGoal = asyncHandler(async (req, res) => {
  const { type } = req.params;
  if (!GOAL_TYPES.includes(type)) throw bad("Unknown goal type");
  const target = Number(req.body.target);
  if (!Number.isInteger(target) || target < 1 || target > MAX_TARGET[type]) {
    throw bad(`Target must be a whole number between 1 and ${MAX_TARGET[type]}`);
  }
  const goal = await Goal.findOneAndUpdate(
    { user: req.user.id, type },
    { $set: { target } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return sendSuccess(res, { message: "Goal saved", data: { goal: { type: goal.type, target: goal.target } } });
});

// DELETE /api/goals/:type
const deleteGoal = asyncHandler(async (req, res) => {
  if (!GOAL_TYPES.includes(req.params.type)) throw bad("Unknown goal type");
  await Goal.deleteOne({ user: req.user.id, type: req.params.type });
  return sendSuccess(res, { message: "Goal removed" });
});

module.exports = { listGoals, setGoal, deleteGoal, goalItems, readDay };
