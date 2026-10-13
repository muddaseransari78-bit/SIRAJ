// Page titles, descriptions and robots rules for every public page (pure functions, easy to test).
import { SURAH_SLUGS, resolveSurahParam, slugToTitle } from "./surahSlugs.js";

export const SITE_NAME = "SIRAJ";
export const DEFAULT_TITLE = "SIRAJ 🕯️ — Illuminate Your Heart With Knowledge";
export const DEFAULT_DESCRIPTION = "SIRAJ is a premium Islamic digital platform for the Quran, Hadith, Tafseer, prayer times, and more.";

// [path prefix, title, description]. The first match wins, so longer prefixes go first.
export const TITLES = [
  ["/quran", "Quran", "Read the complete Quran with translation, audio and Tafseer on SIRAJ."],
  ["/hadith", "Hadith", "Browse Hadith collections with references and search on SIRAJ."],
  ["/tafseer", "Tafseer", "Read Tafseer of every Ayah with its source shown."],
  ["/prayer", "Prayer Times", "Accurate prayer times, countdown and reminders for your location."],
  ["/qibla", "Qibla", "Find the Qibla direction with a live compass."],
  ["/tasbeeh", "Digital Tasbeeh", "A simple digital Tasbeeh counter with targets and history."],
  ["/duas", "Duas & Adhkar", "Duas and daily Adhkar with Arabic, translation and source."],
  ["/calendar", "Islamic Calendar", "Hijri and Gregorian calendar with important Islamic dates."],
  ["/topics", "Quran Topics", "Find Ayahs by theme such as patience or gratitude."],
  ["/assistant", "Source Finder", "Find real Ayahs, Hadith and Duas with their sources."],
  ["/feedback", "Feedback", "Tell the SIRAJ team what works and what to improve (login required)."],
  ["/ramadan", "Ramadan", "Sehri and Iftar times, fasting tracker and Ramadan shortcuts."],
  ["/recitation/live", "Live Recitation", "Recite and watch each word of the Ayah light up as the browser hears it."],
  ["/recitation", "Recitation Practice", "AI-assisted Quran recitation practice with word-by-word feedback."],
  ["/search", "Search", "Search the Quran, Surahs, Hadith, Tafseer and Duas in English, Arabic or Urdu."],
  ["/goals", "My Goals", "Set and track daily worship goals."],
  ["/notifications", "Notifications", "Your SIRAJ notifications."],
  ["/profile", "Profile & Settings", "Manage your SIRAJ account and preferences."],
  ["/progress", "Quran Progress", "Track your Quran reading progress and Khatm."],
  ["/bookmarks", "My Bookmarks", "Your saved Ayahs, Hadith and Duas."],
  ["/dashboard", "My SIRAJ", "Your personal SIRAJ dashboard."],
  ["/about", "About", "About SIRAJ and its data sources."],
  ["/privacy", "Privacy Policy", "How SIRAJ handles your data."],
  ["/terms", "Terms of Use", "SIRAJ terms of use."],
  ["/contact", "Contact", "Contact the SIRAJ team."],
  ["/login", "Login", "Log in to SIRAJ."],
  ["/register", "Create account", "Create your SIRAJ account."],
];

// Personal / account pages: should not appear in Google.
const PRIVATE_PREFIXES = ["/dashboard", "/bookmarks", "/progress", "/goals", "/notifications", "/profile", "/admin", "/login", "/register"];

export function isPrivatePath(pathname) {
  return PRIVATE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Everything the <head> needs for one address. */
export function resolveMeta(pathname) {
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const noindex = isPrivatePath(clean);

  // /quran/al-fatiha (or /quran/1) -> a title that names the Surah
  const surahMatch = clean.match(/^\/quran\/([^/]+)$/);
  if (surahMatch) {
    const n = resolveSurahParam(surahMatch[1]);
    if (n) {
      const name = slugToTitle(SURAH_SLUGS[n - 1]);
      return {
        title: `Surah ${name} — Quran with Translation & Audio — SIRAJ 🕯️`,
        description: `Read Surah ${name} (Surah ${n}) with Arabic text, translation, audio recitation and Tafseer on SIRAJ.`,
        path: `/quran/${SURAH_SLUGS[n - 1]}`,
        noindex,
      };
    }
  }

  const hit = TITLES.find(([prefix]) => clean === prefix || clean.startsWith(`${prefix}/`));
  return {
    title: hit ? `${hit[1]} — SIRAJ 🕯️` : DEFAULT_TITLE,
    description: hit ? hit[2] : DEFAULT_DESCRIPTION,
    path: clean,
    noindex,
  };
}

function setTag(doc, selector, create, content) {
  let el = doc.head.querySelector(selector);
  if (!el) { el = create(); doc.head.appendChild(el); }
  el.setAttribute(el.tagName === "LINK" ? "href" : "content", content);
}

/** Writes title, description, canonical, Open Graph, Twitter and robots tags into the page. */
export function applyMeta(doc, meta, origin) {
  const url = `${origin}${meta.path}`;
  const metaTag = (attr, key) => () => { const m = doc.createElement("meta"); m.setAttribute(attr, key); return m; };
  doc.title = meta.title;
  setTag(doc, 'meta[name="description"]', metaTag("name", "description"), meta.description);
  setTag(doc, 'meta[property="og:title"]', metaTag("property", "og:title"), meta.title);
  setTag(doc, 'meta[property="og:description"]', metaTag("property", "og:description"), meta.description);
  setTag(doc, 'meta[property="og:url"]', metaTag("property", "og:url"), url);
  setTag(doc, 'meta[property="og:site_name"]', metaTag("property", "og:site_name"), SITE_NAME);
  setTag(doc, 'meta[name="twitter:card"]', metaTag("name", "twitter:card"), "summary");
  setTag(doc, 'meta[name="twitter:title"]', metaTag("name", "twitter:title"), meta.title);
  setTag(doc, 'meta[name="twitter:description"]', metaTag("name", "twitter:description"), meta.description);
  setTag(doc, 'link[rel="canonical"]', () => { const l = doc.createElement("link"); l.setAttribute("rel", "canonical"); return l; }, url);
  setTag(doc, 'meta[name="robots"]', metaTag("name", "robots"), meta.noindex ? "noindex, nofollow" : "index, follow");
}
