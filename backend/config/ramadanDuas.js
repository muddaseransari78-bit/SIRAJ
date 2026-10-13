// Duas shown on the Ramadan page. Every entry keeps its source (book + number).
// The reference numbers follow sunnah.com numbering - verify them there before public launch.
// Admins can add more Duas (category "Ramadan") from the Admin panel -> Duas.
module.exports = [
  {
    id: "breaking-fast",
    title: "When breaking the fast",
    arabic: "ذَهَبَ الظَّمَأُ وَابْتَلَّتِ الْعُرُوقُ وَثَبَتَ الأَجْرُ إِنْ شَاءَ اللَّهُ",
    transliteration: "Dhahaba az-zama'u wab-tallatil-'uruqu wa thabatal-ajru in sha'Allah",
    english: "The thirst has gone, the veins are moist, and the reward is confirmed, if Allah wills.",
    source: "Sunan Abi Dawud 2357",
    // Urdu and Arabic versions: the page shows ONE language only (no English or Latin letters in Urdu / Arabic mode)
    ur: { title: "افطار کے وقت", meaning: "پیاس بجھ گئی، رگیں تر ہو گئیں اور اگر اللہ نے چاہا تو اجر ثابت ہو گیا۔", source: "سنن ابی داؤد 2357" },
    ar: { title: "عند الإفطار", meaning: "ذهب العطش، وابتلّت العروق، وثبت الأجر إن شاء الله.", source: "سنن أبي داود 2357" },
  },
  {
    id: "laylat-al-qadr",
    title: "For Laylat al-Qadr",
    arabic: "اللَّهُمَّ إِنَّكَ عَفُوٌّ تُحِبُّ الْعَفْوَ فَاعْفُ عَنِّي",
    transliteration: "Allahumma innaka 'afuwwun tuhibbul-'afwa fa'fu 'anni",
    english: "O Allah, You are Pardoning and You love to pardon, so pardon me.",
    source: "Jami' at-Tirmidhi 3513; Sunan Ibn Majah 3850",
    ur: { title: "لیلۃ القدر کے لیے", meaning: "اے اللہ! بے شک تو معاف کرنے والا ہے، معافی کو پسند کرتا ہے، پس مجھے معاف فرما دے۔", source: "جامع ترمذی 3513؛ سنن ابن ماجہ 3850" },
    ar: { title: "لليلة القدر", meaning: "اللهم إنك كثير العفو، تحب العفو، فاعفُ عني.", source: "جامع الترمذي 3513؛ سنن ابن ماجه 3850" },
  },
];
