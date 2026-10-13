const mongoose = require("mongoose");
const Bookmark = require("../models/Bookmark");
const BookmarkCollection = require("../models/BookmarkCollection");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");

const DEFAULT_COLLECTION = "General";
const TYPES = ["AYAH", "SURAH", "HADITH", "DUA"];

function httpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

const isInt = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;

// Collection names: trimmed text, 1-40 characters
function cleanName(value) {
  if (typeof value !== "string") throw httpError(400, "Collection name is required");
  const name = value.trim().replace(/\s+/g, " ");
  if (name.length < 1 || name.length > 40) throw httpError(400, "Collection name must be 1-40 characters");
  return name;
}

// Older DUA bookmarks stored "dua:<ref>" inside collectionName. Present them in the new shape.
function normalize(doc) {
  const b = doc.toObject ? doc.toObject() : { ...doc };
  if (b.type === "DUA" && !b.duaRef && typeof b.collectionName === "string" && b.collectionName.startsWith("dua:")) {
    b.duaRef = b.collectionName.slice(4);
    b.collectionName = DEFAULT_COLLECTION;
  }
  return b;
}

function ensureObjectId(id) {
  if (!mongoose.isValidObjectId(id)) throw httpError(400, "Invalid id");
}

// ---------- Bookmarks ----------

const getMyBookmarks = asyncHandler(async (req, res) => {
  const docs = await Bookmark.find({ user: req.user.id }).sort({ createdAt: -1 });
  return sendSuccess(res, { message: "Your bookmarks", data: { bookmarks: docs.map(normalize) } });
});

const addBookmark = asyncHandler(async (req, res) => {
  const { type, surahNumber, ayahNumber, hadithBook, hadithNumber } = req.body;
  let { duaRef, collectionName } = req.body;

  if (!TYPES.includes(type)) throw httpError(400, "Bookmark type must be AYAH, SURAH, HADITH or DUA");

  // Old Dua clients sent { collectionName: "dua:<ref>" }
  if (type === "DUA" && !duaRef && typeof collectionName === "string" && collectionName.startsWith("dua:")) {
    duaRef = collectionName.slice(4);
    collectionName = undefined;
  }

  // What makes this bookmark "the same" as one already saved
  let identity;
  let fields;
  if (type === "AYAH") {
    if (!isInt(surahNumber, 1, 114) || !isInt(ayahNumber, 1, 286)) throw httpError(400, "Valid surahNumber and ayahNumber are required");
    identity = fields = { surahNumber, ayahNumber };
  } else if (type === "SURAH") {
    if (!isInt(surahNumber, 1, 114)) throw httpError(400, "Valid surahNumber is required");
    identity = fields = { surahNumber };
  } else if (type === "HADITH") {
    if (typeof hadithBook !== "string" || !hadithBook || hadithBook.length > 50 || (hadithNumber === undefined || String(hadithNumber).length > 20)) {
      throw httpError(400, "hadithBook and hadithNumber are required");
    }
    identity = fields = { hadithBook, hadithNumber: String(hadithNumber) };
  } else {
    if (typeof duaRef !== "string" || !duaRef || duaRef.length > 100) throw httpError(400, "duaRef is required");
    identity = fields = { duaRef };
  }

  // Already saved? Return it instead of creating a duplicate.
  const existing = await Bookmark.findOne({ user: req.user.id, type, ...identity });
  if (existing) {
    return sendSuccess(res, { message: "Already bookmarked", data: { bookmark: normalize(existing), alreadySaved: true } });
  }

  const collection = collectionName ? cleanName(collectionName) : DEFAULT_COLLECTION;
  if (collection !== DEFAULT_COLLECTION) {
    await BookmarkCollection.updateOne({ user: req.user.id, name: collection }, { $setOnInsert: { name: collection } }, { upsert: true });
  }

  const bookmark = await Bookmark.create({ user: req.user.id, type, ...fields, collectionName: collection });
  return sendSuccess(res, { statusCode: 201, message: "Bookmark saved", data: { bookmark: normalize(bookmark), alreadySaved: false } });
});

// PATCH /api/bookmarks/:id  { collectionName }  -> move a bookmark to another collection
const moveBookmark = asyncHandler(async (req, res) => {
  ensureObjectId(req.params.id);
  const collection = cleanName(req.body.collectionName);

  const existing = await Bookmark.findOne({ _id: req.params.id, user: req.user.id });
  if (!existing) throw httpError(404, "Bookmark not found");

  const set = { collectionName: collection };
  // Keep the Dua reference of old-style bookmarks before overwriting collectionName
  const legacy = normalize(existing);
  if (legacy.type === "DUA" && !existing.duaRef && legacy.duaRef) set.duaRef = legacy.duaRef;

  if (collection !== DEFAULT_COLLECTION) {
    await BookmarkCollection.updateOne({ user: req.user.id, name: collection }, { $setOnInsert: { name: collection } }, { upsert: true });
  }

  const bookmark = await Bookmark.findOneAndUpdate({ _id: req.params.id, user: req.user.id }, { $set: set }, { new: true });
  return sendSuccess(res, { message: "Bookmark moved", data: { bookmark: normalize(bookmark) } });
});

const removeBookmark = asyncHandler(async (req, res) => {
  ensureObjectId(req.params.id);
  const bookmark = await Bookmark.findOneAndDelete({ _id: req.params.id, user: req.user.id });
  if (!bookmark) throw httpError(404, "Bookmark not found");
  return sendSuccess(res, { message: "Bookmark removed" });
});

// ---------- Collections ----------

// GET /api/bookmarks/collections -> [{ name, count }]  ("General" always first)
const getCollections = asyncHandler(async (req, res) => {
  const [stored, bookmarks] = await Promise.all([
    BookmarkCollection.find({ user: req.user.id }).sort({ name: 1 }).lean(),
    Bookmark.find({ user: req.user.id }).select("type collectionName").lean(),
  ]);

  const counts = new Map([[DEFAULT_COLLECTION, 0]]);
  stored.forEach((c) => counts.set(c.name, 0));
  bookmarks.forEach((b) => {
    const name = normalize(b).collectionName || DEFAULT_COLLECTION;
    counts.set(name, (counts.get(name) || 0) + 1);
  });

  const collections = [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => (a.name === DEFAULT_COLLECTION ? -1 : b.name === DEFAULT_COLLECTION ? 1 : a.name.localeCompare(b.name)));

  return sendSuccess(res, { message: "Bookmark collections", data: { collections } });
});

const createCollection = asyncHandler(async (req, res) => {
  const name = cleanName(req.body.name);
  if (name.toLowerCase() === DEFAULT_COLLECTION.toLowerCase()) throw httpError(400, `"${DEFAULT_COLLECTION}" already exists`);

  const count = await BookmarkCollection.countDocuments({ user: req.user.id });
  if (count >= 50) throw httpError(400, "You can have at most 50 collections");

  try {
    await BookmarkCollection.create({ user: req.user.id, name });
  } catch (err) {
    if (err.code === 11000) throw httpError(409, "A collection with this name already exists");
    throw err;
  }
  return sendSuccess(res, { statusCode: 201, message: "Collection created", data: { name } });
});

// PATCH /api/bookmarks/collections/rename  { from, to }
const renameCollection = asyncHandler(async (req, res) => {
  const from = cleanName(req.body.from);
  const to = cleanName(req.body.to);
  if (from === DEFAULT_COLLECTION) throw httpError(400, `"${DEFAULT_COLLECTION}" cannot be renamed`);
  if (to.toLowerCase() === DEFAULT_COLLECTION.toLowerCase()) throw httpError(400, `"${DEFAULT_COLLECTION}" is reserved`);

  const clash = await BookmarkCollection.findOne({ user: req.user.id, name: to });
  if (clash && from !== to) throw httpError(409, "A collection with this name already exists");

  const collection = await BookmarkCollection.findOneAndUpdate({ user: req.user.id, name: from }, { $set: { name: to } });
  if (!collection) throw httpError(404, "Collection not found");

  await Bookmark.updateMany({ user: req.user.id, collectionName: from }, { $set: { collectionName: to } });
  return sendSuccess(res, { message: "Collection renamed", data: { name: to } });
});

// DELETE /api/bookmarks/collections?name=...  -> bookmarks inside move back to "General" (nothing is lost)
const deleteCollection = asyncHandler(async (req, res) => {
  const name = cleanName(req.query.name);
  if (name === DEFAULT_COLLECTION) throw httpError(400, `"${DEFAULT_COLLECTION}" cannot be deleted`);

  await Bookmark.updateMany({ user: req.user.id, collectionName: name }, { $set: { collectionName: DEFAULT_COLLECTION } });
  const result = await BookmarkCollection.deleteOne({ user: req.user.id, name });
  if (result.deletedCount === 0) throw httpError(404, "Collection not found");

  return sendSuccess(res, { message: "Collection deleted. Its bookmarks were moved to General." });
});

module.exports = {
  getMyBookmarks, addBookmark, moveBookmark, removeBookmark,
  getCollections, createCollection, renameCollection, deleteCollection,
};
