// Starter Duas: ONLY supplications that are verses of the Quran, so every reference (Surah:Ayah) can be checked
// in any Mushaf. Hadith-based Duas are NOT typed in by hand - they come from `npm run import-duas`.
// The short English/Urdu lines are plain meanings written by SIRAJ, not an official translation -
// the source line says so. Please have a knowledgeable person review this file before you go live.
const NOTE = "meaning in simple words by SIRAJ - compare with a trusted translation";

const STARTER_DUAS = [
  {
    key: "quran-2-201", category: "general", title: "Good in this world and the next",
    arabic: "رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ",
    english: "Our Lord, give us good in this world and good in the Hereafter, and protect us from the punishment of the Fire.",
    urdu: "اے ہمارے رب! ہمیں دنیا میں بھلائی دے اور آخرت میں بھی بھلائی دے اور ہمیں آگ کے عذاب سے بچا۔",
    source: `Quran 2:201 (${NOTE})`,
  },
  {
    key: "quran-3-8", category: "general", title: "Steadfast hearts",
    arabic: "رَبَّنَا لَا تُزِغْ قُلُوبَنَا بَعْدَ إِذْ هَدَيْتَنَا وَهَبْ لَنَا مِن لَّدُنكَ رَحْمَةً ۚ إِنَّكَ أَنتَ الْوَهَّابُ",
    english: "Our Lord, do not let our hearts deviate after You have guided us, and grant us mercy from Yourself; indeed You are the Bestower.",
    urdu: "اے ہمارے رب! ہدایت دینے کے بعد ہمارے دلوں کو ٹیڑھا نہ کر اور ہمیں اپنی طرف سے رحمت عطا فرما، بے شک تو ہی بہت عطا کرنے والا ہے۔",
    source: `Quran 3:8 (${NOTE})`,
  },
  {
    key: "quran-20-114", category: "general", title: "Increase me in knowledge",
    arabic: "رَّبِّ زِدْنِي عِلْمًا",
    english: "My Lord, increase me in knowledge.",
    urdu: "اے میرے رب! میرے علم میں اضافہ فرما۔",
    source: `Quran 20:114 (${NOTE})`,
  },
  {
    key: "quran-14-40", category: "general", title: "Establishing prayer",
    arabic: "رَبِّ اجْعَلْنِي مُقِيمَ الصَّلَاةِ وَمِن ذُرِّيَّتِي ۚ رَبَّنَا وَتَقَبَّلْ دُعَاءِ",
    english: "My Lord, make me an establisher of prayer, and from my descendants. Our Lord, accept my supplication.",
    urdu: "اے میرے رب! مجھے نماز قائم کرنے والا بنا اور میری اولاد میں سے بھی۔ اے ہمارے رب! میری دعا قبول فرما۔",
    source: `Quran 14:40 (${NOTE})`,
  },
  {
    key: "quran-7-23", category: "forgiveness", title: "Forgiveness and mercy",
    arabic: "رَبَّنَا ظَلَمْنَا أَنفُسَنَا وَإِن لَّمْ تَغْفِرْ لَنَا وَتَرْحَمْنَا لَنَكُونَنَّ مِنَ الْخَاسِرِينَ",
    english: "Our Lord, we have wronged ourselves; if You do not forgive us and have mercy on us, we will surely be among the losers.",
    urdu: "اے ہمارے رب! ہم نے اپنی جانوں پر ظلم کیا، اور اگر تو نے ہمیں معاف نہ کیا اور ہم پر رحم نہ فرمایا تو ہم ضرور نقصان اٹھانے والوں میں سے ہوں گے۔",
    source: `Quran 7:23 (${NOTE})`,
  },
  {
    key: "quran-21-87", category: "forgiveness", title: "The Dua of Yunus (peace be upon him)",
    arabic: "لَّا إِلَٰهَ إِلَّا أَنتَ سُبْحَانَكَ إِنِّي كُنتُ مِنَ الظَّالِمِينَ",
    english: "There is no god but You; glory be to You; indeed I was among the wrongdoers.",
    urdu: "تیرے سوا کوئی معبود نہیں، تو پاک ہے، بے شک میں ظالموں میں سے تھا۔",
    source: `Quran 21:87 (${NOTE})`,
  },
  {
    key: "quran-2-286", category: "forgiveness", title: "Forgetting and mistakes",
    arabic: "رَبَّنَا لَا تُؤَاخِذْنَا إِن نَّسِينَا أَوْ أَخْطَأْنَا",
    english: "Our Lord, do not hold us accountable if we forget or make a mistake.",
    urdu: "اے ہمارے رب! اگر ہم بھول جائیں یا غلطی کر بیٹھیں تو ہمیں نہ پکڑ۔",
    source: `Quran 2:286, part of the verse (${NOTE})`,
  },
  {
    key: "quran-17-24", category: "parents", title: "For my parents",
    arabic: "رَّبِّ ارْحَمْهُمَا كَمَا رَبَّيَانِي صَغِيرًا",
    english: "My Lord, have mercy on them (my parents) as they raised me when I was small.",
    urdu: "اے میرے رب! ان دونوں (والدین) پر رحم فرما جیسا کہ انہوں نے بچپن میں مجھے پالا۔",
    source: `Quran 17:24, part of the verse (${NOTE})`,
  },
  {
    key: "quran-25-74", category: "family", title: "For spouse and children",
    arabic: "رَبَّنَا هَبْ لَنَا مِنْ أَزْوَاجِنَا وَذُرِّيَّاتِنَا قُرَّةَ أَعْيُنٍ وَاجْعَلْنَا لِلْمُتَّقِينَ إِمَامًا",
    english: "Our Lord, grant us from our spouses and offspring comfort to our eyes, and make us leaders for the righteous.",
    urdu: "اے ہمارے رب! ہمیں ہماری بیویوں اور اولاد سے آنکھوں کی ٹھنڈک عطا فرما اور ہمیں پرہیزگاروں کا امام بنا۔",
    source: `Quran 25:74 (${NOTE})`,
  },
  {
    key: "quran-43-13", category: "travel", title: "When riding or travelling",
    arabic: "سُبْحَانَ الَّذِي سَخَّرَ لَنَا هَٰذَا وَمَا كُنَّا لَهُ مُقْرِنِينَ وَإِنَّا إِلَىٰ رَبِّنَا لَمُنقَلِبُونَ",
    english: "Glory to Him who has subjected this to us, and we could not have done it ourselves; and indeed to our Lord we will return.",
    urdu: "پاک ہے وہ ذات جس نے اسے ہمارے تابع کر دیا، حالانکہ ہم اسے قابو میں لانے والے نہ تھے، اور بے شک ہم اپنے رب ہی کی طرف لوٹ کر جانے والے ہیں۔",
    source: `Quran 43:13-14 (${NOTE})`,
  },
  {
    key: "quran-23-97", category: "protection", title: "Refuge from the whispers of the devils",
    arabic: "رَّبِّ أَعُوذُ بِكَ مِنْ هَمَزَاتِ الشَّيَاطِينِ وَأَعُوذُ بِكَ رَبِّ أَن يَحْضُرُونِ",
    english: "My Lord, I seek refuge in You from the whisperings of the devils, and I seek refuge in You, my Lord, lest they be present with me.",
    urdu: "اے میرے رب! میں شیطانوں کے وسوسوں سے تیری پناہ مانگتا ہوں، اور اے میرے رب! اس سے بھی تیری پناہ مانگتا ہوں کہ وہ میرے پاس آئیں۔",
    source: `Quran 23:97-98 (${NOTE})`,
  },
];

module.exports = { STARTER_DUAS };
