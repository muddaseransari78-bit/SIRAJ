// Turns Dua data into Dua-model documents. Pure functions (no database, no network) so they are easy to test.

// Text can arrive as a plain string, as { text } / { en }, with HTML tags: always return clean plain text.
function textOf(value) {
  if (value == null) return "";
  const raw = typeof value === "string" ? value : (value.text ?? value.en ?? value.ar ?? "");
  return String(raw).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

const CATEGORY_RE = /^[a-z0-9-]{2,40}$/;

/** One starter Dua (data/starterDuas.js) -> Dua document, or null if it is incomplete. */
function starterToDoc(item) {
  if (!item || !item.arabic || !item.source || !CATEGORY_RE.test(item.category || "")) return null;
  return {
    externalKey: `starter:${item.key}`,
    externalSlug: `starter-${item.key}`,
    origin: "starter",
    category: item.category,
    title: item.title || "",
    arabic: item.arabic,
    transliteration: item.transliteration || "",
    urdu: item.urdu || "",
    english: item.english || "",
    source: item.source,
    isActive: true,
  };
}

/**
 * One Dua from the outside Hisn al-Muslim API -> Dua document.
 * Returns null when it has no Arabic text or NO SOURCE: SIRAJ never stores a Dua without where it came from.
 */
function externalToDoc(category, dua, index = 0) {
  if (!dua || !CATEGORY_RE.test(category || "")) return null;
  const arabic = textOf(dua.ar);
  const source = textOf(dua.source);
  if (!arabic || !source) return null;
  const slug = String(dua.slug || `${category}-${index + 1}`).slice(0, 100);
  return {
    externalKey: `hisn:${category}:${slug}`,
    externalSlug: slug,
    origin: "import",
    category,
    title: textOf(dua.title).slice(0, 120),
    arabic: arabic.slice(0, 2000),
    transliteration: textOf(dua.transliteration).slice(0, 2000),
    urdu: textOf(dua.ur).slice(0, 2000),
    english: textOf(dua.en).slice(0, 2000),
    source: source.slice(0, 300),
    isActive: true,
  };
}

/** The link name of a stored Dua: admin-written ones keep "custom-<id>"; imported/starter ones keep their own slug. */
function duaSlug(row) {
  return row.externalSlug || `custom-${row._id}`;
}

/** Shapes a stored Dua like the outside API so the same card can show it. */
function toApiShape(row) {
  return {
    slug: duaSlug(row),
    title: row.title,
    ar: { text: row.arabic },
    transliteration: { en: row.transliteration },
    en: { text: row.english },
    ur: { text: row.urdu, machine: Boolean(row.urduMachine) },
    source: { en: row.source },
    custom: (row.origin || "admin") !== "import", // "added by SIRAJ" label; imported Hisn al-Muslim Duas show their source only
    origin: row.origin || "admin",
  };
}

module.exports = { textOf, starterToDoc, externalToDoc, duaSlug, toApiShape };
