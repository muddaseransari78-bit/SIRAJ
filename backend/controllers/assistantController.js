const quranApi = require("../services/external/quranApi");
const hadithApi = require("../services/external/hadithApi");
const { searchDuas } = require("../services/searchService");
const { interpret } = require("../services/assistantService");
const M = require("../utils/searchMath");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");

const ask = asyncHandler(async (req, res) => {
  const q = String(req.body?.q || "").trim();
  if (q.length < 2 || q.length > 100) {
    const err = new Error("Please type between 2 and 100 characters");
    err.statusCode = 400;
    throw err;
  }

  let surahs = [];
  try { surahs = await quranApi.getAllSurahs(); } catch (e) { /* name matching just won't work */ }
  const plan = interpret(q, surahs);
  const script = M.detectScript(q); // "latin" | "arabic" | "urdu"
  let alsoSearch = false;           // an Arabic / Urdu Surah name is shown AND the words are still searched

  // Arabic / Urdu typing: Arabic digits (٢:٢٥٥) and Surah names written in Arabic script
  if (!plan.reference && !plan.surah) {
    const ref = M.parseReference(q, surahs);
    if (ref) plan.reference = ref;
    else if (script !== "latin") {
      const hit = M.matchSurahs(q, surahs, 1)[0];
      if (hit && hit.score >= 85) { plan.surah = hit; alsoSearch = true; }
    }
  }

  const base = {
    query: q, reference: plan.reference,
    surah: plan.surah ? { number: plan.surah.number, englishName: plan.surah.englishName || null, name: plan.surah.name || null } : null,
    navigation: plan.navigation, quran: [], hadith: [], duas: [], errors: { quran: false, hadith: false, duas: false },
  };

  // A reference or a Surah name needs no searching
  if (plan.reference || (plan.surah && !alsoSearch)) return sendSuccess(res, { message: "Source finder", data: base });

  // Which text to search for what was typed: English translation / Arabic text / Urdu translation
  const quranEdition = script === "arabic" ? "quran-simple" : script === "urdu" ? "ur.jalandhry" : "en";
  const quranTerm = script === "latin" ? plan.searchTerm : M.stripArabicMarks(plan.searchTerm);
  const matchKind = script === "arabic" ? "arabic" : script === "urdu" ? "urdu" : "translation";

  const [quran, hadith, duas] = await Promise.allSettled([
    quranApi.searchQuran(quranTerm, quranEdition),
    // The Hadith source cannot search Urdu words: skip it instead of showing a false "nothing found"
    script === "urdu" ? Promise.resolve({ hadiths: [] }) : hadithApi.searchHadiths(plan.searchTerm, { limit: 5 }),
    searchDuas(plan.searchTerm),
  ]);
  const hadithData = hadith.status === "fulfilled" ? hadith.value : null;
  const quranShown = (quran.status === "fulfilled" ? quran.value.slice(0, 5) : []).map((r) => ({ ...r, matches: [{ kind: matchKind }] }));
  // Urdu / Arabic readers get each Ayah in their own language
  if (req.body?.lang === "ur" || req.body?.lang === "ar") await quranApi.attachAyahTexts(quranShown);
  return sendSuccess(res, {
    message: "Source finder",
    data: {
      ...base,
      quran: quranShown,
      hadith: (hadithData?.hadiths || hadithData?.results || []).slice(0, 3),
      duas: duas.status === "fulfilled" ? duas.value.slice(0, 3) : [],
      errors: { quran: quran.status === "rejected", hadith: hadith.status === "rejected", duas: duas.status === "rejected" },
    },
  });
});

module.exports = { ask };
