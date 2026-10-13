/**
 * Puts Duas into YOUR database so the Dua pages never depend on an outside website.
 *
 *   npm run seed-duas      -> adds the starter Duas (Quran verses). Safe to run again.
 *   npm run import-duas    -> also copies the Hisn al-Muslim Duas from the outside API (needs internet).
 *
 * Existing rows are never overwritten (so edits made in the admin panel stay). Duas without a source are skipped.
 */
require("dotenv").config();
const mongoose = require("mongoose");
const Dua = require("../models/Dua");
const api = require("../services/external/duaQiblaApi");
const urduDua = require("../services/external/urduDua");
const { STARTER_DUAS } = require("../data/starterDuas");
const { starterToDoc, externalToDoc } = require("../utils/duaImport");

async function upsertAll(docs) {
  if (!docs.length) return { added: 0, existing: 0 };
  const result = await Dua.bulkWrite(
    docs.map((doc) => ({ updateOne: { filter: { externalKey: doc.externalKey }, update: { $setOnInsert: doc }, upsert: true } }))
  );
  const added = result.upsertedCount || 0;
  return { added, existing: docs.length - added };
}

(async () => {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI is not set in backend/.env"); process.exit(1); }
  await mongoose.connect(process.env.MONGO_URI);
  await Dua.init(); // make sure the unique index on externalKey exists

  const starter = STARTER_DUAS.map(starterToDoc).filter(Boolean);
  const s = await upsertAll(starter);
  console.log(`Starter Duas: ${s.added} added, ${s.existing} already there.`);

  if (process.argv.includes("--import")) {
    let added = 0, existing = 0, skipped = 0, failedCategories = 0;
    for (const category of api.DUA_SHORTCUTS) {
      try {
        const data = await api.getDuasByCategory(category);
        const rows = (data?.duas || []).map((d, i) => externalToDoc(category, d, i));
        skipped += rows.filter((r) => !r).length;
        const r = await upsertAll(rows.filter(Boolean));
        added += r.added; existing += r.existing;
        console.log(`  ${category}: ${r.added} added`);
      } catch (e) {
        failedCategories += 1;
        console.log(`  ${category}: could not load (${e.message})`);
      }
    }
    console.log(`Import done: ${added} added, ${existing} already there, ${skipped} skipped (no Arabic or no source), ${failedCategories} categories failed.`);
    // Urdu for every stored Dua that has none yet (machine translation, saved once)
    const missing = await Dua.find({ urdu: "", english: { $ne: "" }, isActive: true });
    let translated = 0;
    for (const row of missing) {
      const text = await urduDua.translateToUrdu(row.english);
      if (text) { await Dua.updateOne({ _id: row._id, urdu: "" }, { $set: { urdu: text, urduMachine: true } }); translated += 1; }
    }
    console.log(`Urdu added to ${translated} of ${missing.length} Duas (machine translation - the rest are filled when someone opens them).`);
    if (failedCategories === api.DUA_SHORTCUTS.length) console.log("Every category failed: the outside Dua API is not reachable. The starter Duas still work.");
  }
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
