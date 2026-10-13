// Turns the Tajweed-marked text from AlQuran Cloud into pieces that can be coloured.
// Marked text looks like:  "بِسْمِ [h:1[ٱ]للَّهِ ..."  ->  [rule letter : optional id [ letters ]
// The colours only show the RULE MARKED BY THE SOURCE. They are a study aid and can be imperfect.

const MARK = /\[([a-z])(?::(\d+))?\[([^\]]*)\]/g;

// rule letter -> css class suffix + English name (used in the legend and as a tooltip)
export const TAJWEED_RULES = [
  { code: "h", name: "Hamzat al-Wasl", cls: "tj-h" },
  { code: "s", name: "Silent letter", cls: "tj-s" },
  { code: "l", name: "Lam Shamsiyyah", cls: "tj-l" },
  { code: "n", name: "Normal madd (2 counts)", cls: "tj-n" },
  { code: "p", name: "Permissible madd (2, 4 or 6)", cls: "tj-p" },
  { code: "o", name: "Obligatory madd (4-5)", cls: "tj-o" },
  { code: "m", name: "Necessary madd (6)", cls: "tj-m" },
  { code: "q", name: "Qalqalah", cls: "tj-q" },
  { code: "f", name: "Ikhfa'", cls: "tj-f" },
  { code: "c", name: "Ikhfa' Shafawi (with Meem)", cls: "tj-c" },
  { code: "w", name: "Idgham Shafawi (with Meem)", cls: "tj-w" },
  { code: "i", name: "Iqlab", cls: "tj-i" },
  { code: "a", name: "Idgham with Ghunnah", cls: "tj-a" },
  { code: "u", name: "Idgham without Ghunnah", cls: "tj-u" },
  { code: "d", name: "Idgham Mutakallimayn", cls: "tj-d" },
  { code: "b", name: "Idgham Mutajanisayn", cls: "tj-b" },
  { code: "g", name: "Ghunnah (2 counts)", cls: "tj-g" },
];

const BY_CODE = Object.fromEntries(TAJWEED_RULES.map((r) => [r.code, r]));

/**
 * Returns [{ text, rule }] where rule is null for unmarked text.
 * Unknown rule letters are kept as plain text, and leftover "[" "]" are removed,
 * so a change in the source format can never make the Ayah unreadable.
 */
export function parseTajweed(marked) {
  const pieces = [];
  let last = 0;
  const source = String(marked || "");
  for (const m of source.matchAll(MARK)) {
    if (m.index > last) pieces.push({ text: source.slice(last, m.index), rule: null });
    pieces.push({ text: m[3], rule: BY_CODE[m[1]] || null });
    last = m.index + m[0].length;
  }
  if (last < source.length) pieces.push({ text: source.slice(last), rule: null });
  return pieces
    .map((p) => ({ ...p, text: p.text.replace(/[\[\]]/g, "") }))
    .filter((p) => p.text !== "");
}

// The plain letters of a marked text (used to check it matches the normal Arabic text)
export function stripTajweed(marked) {
  return parseTajweed(marked).map((p) => p.text).join("");
}
