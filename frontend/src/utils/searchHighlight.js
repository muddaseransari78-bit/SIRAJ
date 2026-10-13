// Splits a text into pieces so the words the user searched for can be highlighted.
// Arabic-aware: the search word "الحمد" also highlights "ٱلْحَمْدُ" (harakat and alef/yeh/kaf variants ignored).
// It only marks text - it never changes it.

const MARKS = "[\\u064B-\\u065F\\u0670\\u06D6-\\u06ED\\u0640]*";
const MARKS_RE = /[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;
const ARABIC_LETTER_RE = /[\u0621-\u064A\u0671-\u06D3]/;

// letters that people (and the Quran text) write in several ways
const VARIANTS = [
  ["ا", "[اأإآٱ]"],
  ["أ", "[اأإآٱ]"], ["إ", "[اأإآٱ]"], ["آ", "[اأإآٱ]"], ["ٱ", "[اأإآٱ]"],
  ["ي", "[يىیئ]"], ["ى", "[يىیئ]"], ["ی", "[يىیئ]"],
  ["ك", "[كک]"], ["ک", "[كک]"],
  ["ه", "[هة]"], ["ة", "[هة]"],
];
const VARIANT_MAP = new Map(VARIANTS);

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function letterPattern(ch) {
  if (ARABIC_LETTER_RE.test(ch)) return `${VARIANT_MAP.get(ch) || escapeRegExp(ch)}${MARKS}`;
  return escapeRegExp(ch);
}

// A RegExp that finds any word of the query inside a text, or null if there is nothing worth marking.
export function buildHighlightRegex(query) {
  const words = [...new Set(String(query || "").replace(MARKS_RE, "").trim().split(/\s+/))]
    .filter((w) => w.length >= 2 || ARABIC_LETTER_RE.test(w))
    .slice(0, 6);
  if (words.length === 0) return null;
  const patterns = words
    .sort((a, b) => b.length - a.length) // longest first so "patient" wins over "pa"
    .map((w) => [...w].map(letterPattern).join(""));
  return new RegExp(patterns.join("|"), "giu");
}

// "Allah is with the patient" + "patient" -> [{text:"Allah is with the ", hit:false}, {text:"patient", hit:true}]
export function splitHighlight(text, query) {
  const str = String(text ?? "");
  const re = buildHighlightRegex(query);
  if (!re || !str) return [{ text: str, hit: false }];
  const parts = [];
  let last = 0;
  let m;
  while ((m = re.exec(str)) !== null) {
    if (m[0].length === 0) { re.lastIndex++; continue; }
    if (m.index > last) parts.push({ text: str.slice(last, m.index), hit: false });
    parts.push({ text: m[0], hit: true });
    last = m.index + m[0].length;
  }
  if (last < str.length) parts.push({ text: str.slice(last), hit: false });
  return parts.length ? parts : [{ text: str, hit: false }];
}

// Removes HTML tags some sources put in their text (never used for display of Arabic letters)
export const stripTags = (t) => String(t || "").replace(/<[^>]+>/g, "");
