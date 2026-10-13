// Usage (in the frontend folder):  npm run sitemap -- https://your-site.com
// Writes public/sitemap.xml with all public pages and all 114 Surahs.
import { writeFileSync } from "node:fs";
import { SURAH_SLUGS } from "../src/utils/surahSlugs.js";

const site = (process.argv[2] || "").replace(/\/+$/, "");
if (!/^https?:\/\//.test(site)) {
  console.error("Give your site address, e.g.:  npm run sitemap -- https://siraj.example.com");
  process.exit(1);
}
const pages = ["/", "/quran", "/hadith", "/tafseer", "/prayer", "/qibla", "/tasbeeh", "/duas", "/calendar", "/topics", "/assistant", "/feedback", "/ramadan", "/recitation", "/search", "/about", "/privacy", "/terms", "/contact"];
const urls = [...pages, ...SURAH_SLUGS.map((s) => `/quran/${s}`)];
const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${site}${u}</loc></url>`).join("\n")}\n</urlset>\n`;
writeFileSync(new URL("../public/sitemap.xml", import.meta.url), xml);
console.log(`sitemap.xml written with ${urls.length} addresses for ${site}`);
