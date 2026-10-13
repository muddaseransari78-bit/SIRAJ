// Things the global search can find WITHOUT calling any external API.
// Everything here is SIRAJ's own navigation - no religious text is stored in this file.

// Every kind of result the search can return. The frontend filter chips use the same names.
const SEARCH_TYPES = ["surahs", "quran", "hadith", "books", "tafseer", "duas", "topics", "pages"];

// "Islamic content" = the sections of SIRAJ itself, so searching "qibla" or "iftar" opens the right page.
const PAGES = [
  { to: "/quran", label: "Quran", description: "All 114 Surahs with translation and audio", keywords: ["quran", "koran", "surah", "surahs", "ayah", "ayat", "mushaf", "قرآن", "قران"] },
  { to: "/hadith", label: "Hadith library", description: "Major Hadith collections with references", keywords: ["hadith", "hadees", "ahadith", "sunnah", "حدیث", "حديث"] },
  { to: "/tafseer", label: "Tafseer", description: "Tafseer of every Ayah with its source", keywords: ["tafseer", "tafsir", "explanation", "commentary", "تفسیر", "تفسير"] },
  { to: "/duas", label: "Duas & Adhkar", description: "Duas from Hisn al-Muslim with sources", keywords: ["dua", "duas", "adhkar", "azkar", "supplication", "دعا", "دعاء", "أذكار"] },
  { to: "/prayer", label: "Prayer times", description: "Today's prayer times and countdown", keywords: ["prayer", "prayer times", "salah", "salat", "namaz", "fajr", "dhuhr", "zuhr", "asr", "maghrib", "isha", "adhan", "azan", "نماز", "صلاة"] },
  { to: "/qibla", label: "Qibla compass", description: "Find the direction of the Kaaba", keywords: ["qibla", "kibla", "kaaba", "kabah", "compass", "direction", "قبلہ", "قبلة"] },
  { to: "/tasbeeh", label: "Digital Tasbeeh", description: "Count your dhikr", keywords: ["tasbeeh", "tasbih", "dhikr", "zikr", "counter", "subhanallah", "alhamdulillah", "تسبیح", "تسبيح"] },
  { to: "/calendar", label: "Islamic calendar", description: "Hijri dates and important Islamic days", keywords: ["calendar", "hijri", "islamic date", "eid", "muharram", "ashura", "islamic events", "کیلنڈر", "تقويم"] },
  { to: "/ramadan", label: "Ramadan", description: "Sehri, Iftar and fasting tracker", keywords: ["ramadan", "ramzan", "sehri", "suhoor", "iftar", "fasting", "roza", "taraweeh", "رمضان", "رمضان"] },
  { to: "/topics", label: "Quran topics", description: "Find Ayahs by theme", keywords: ["topic", "topics", "theme", "themes"] },
  { to: "/recitation/live", label: "Live recitation", description: "Recite and watch each word light up", keywords: ["recite", "recitation", "live recitation", "tilawat", "tajweed", "practice", "تلاوت"] },
  { to: "/assistant", label: "Source finder", description: "Find real Ayahs, Hadith and Duas with sources", keywords: ["assistant", "source finder", "ask", "find"] },
  { to: "/bookmarks", label: "My bookmarks", description: "Your saved Ayahs, Hadith and Duas", keywords: ["bookmark", "bookmarks", "saved", "favorites", "favourites", "collections"] },
  { to: "/progress", label: "Quran progress", description: "Reading progress and Khatm", keywords: ["progress", "khatm", "streak", "reading progress"] },
  { to: "/goals", label: "My goals", description: "Daily worship goals", keywords: ["goal", "goals"] },
  { to: "/dashboard", label: "My SIRAJ dashboard", description: "Your personal overview", keywords: ["dashboard", "my siraj", "history", "overview"] },
  { to: "/profile", label: "Profile & settings", description: "Language, font and prayer settings", keywords: ["profile", "settings", "password", "language", "account", "preferences"] },
  { to: "/notifications", label: "Notifications", description: "Your SIRAJ notifications", keywords: ["notification", "notifications", "reminders", "alerts"] },
  { to: "/about", label: "About SIRAJ", description: "Mission and data sources", keywords: ["about", "sources", "data sources", "references", "mission"] },
  { to: "/privacy", label: "Privacy policy", description: "How SIRAJ handles your data", keywords: ["privacy", "data", "microphone", "location permission"] },
  { to: "/terms", label: "Terms of use", description: "SIRAJ terms", keywords: ["terms", "conditions"] },
  { to: "/contact", label: "Contact", description: "Contact the SIRAJ team", keywords: ["contact", "feedback", "support", "help"] },
];

// Readable names for the Hisn al-Muslim dua categories (same words the Duas page shows).
const DUA_LABELS = {
  morning: "Morning", evening: "Evening", "after-prayer": "After Prayer", "before-sleep": "Before Sleeping",
  "waking-up": "After Waking", prayer: "Prayer", mosque: "Mosque", travel: "Travel", food: "Food",
  home: "Home", anxiety: "Anxiety", protection: "Protection", forgiveness: "Forgiveness", hajj: "Hajj",
};

module.exports = { SEARCH_TYPES, PAGES, DUA_LABELS };
