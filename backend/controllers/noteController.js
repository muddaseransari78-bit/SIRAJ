const Note = require("../models/Note");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const httpError = require("../utils/httpError");

const getMyNotes = asyncHandler(async (req, res) => {
  const notes = await Note.find({ user: req.user.id }).sort({ createdAt: -1 });
  return sendSuccess(res, { message: "Your notes", data: { notes } });
});

const addNote = asyncHandler(async (req, res) => {
  const { surahNumber, ayahNumber } = req.body;
  const text = typeof req.body.text === "string" ? req.body.text.trim() : "";

  if (!Number.isInteger(surahNumber) || surahNumber < 1 || surahNumber > 114) {
    throw httpError(400, "A valid surahNumber (1-114) is required");
  }
  if (!Number.isInteger(ayahNumber) || ayahNumber < 1 || ayahNumber > 286) {
    throw httpError(400, "A valid ayahNumber (1-286) is required");
  }
  if (!text) throw httpError(400, "Note text is required");
  if (text.length > 2000) throw httpError(400, "Note text must be at most 2000 characters");

  const note = await Note.create({ user: req.user.id, surahNumber, ayahNumber, text });
  return sendSuccess(res, { statusCode: 201, message: "Note saved", data: { note } });
});

const deleteNote = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const note = await Note.findOneAndDelete({ _id: id, user: req.user.id });

  if (!note) throw httpError(404, "Note not found");

  return sendSuccess(res, { message: "Note deleted" });
});

module.exports = { getMyNotes, addNote, deleteNote };
