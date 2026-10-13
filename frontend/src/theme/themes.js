// SIRAJ themes (Phase 29). THIS FILE IS THE ONLY PLACE WHERE THEME COLOURS LIVE.
//
// To change a colour: edit it here, then run `npm run theme:css` (dev/build/test run it for you automatically).
// That regenerates src/theme/themes.css and public/theme-init.js, so the site, the 3D scene and the tests all agree.
//
// Colour roles (the names stay "noor-*" so every old Tailwind class keeps working):
//   bg / surface / surface2 / border   -> page, cards, raised cards, lines
//   text / textMuted                   -> normal text, quiet text
//   gold / goldBright                  -> the theme ACCENT (buttons / links). goldBright = accent used as TEXT, so it must be readable on bg
//   onAccent                           -> text that sits on a gold button
//   emerald / emeraldBright            -> secondary green (success states)
//   radial                             -> glow colour at the top of the page / hero
//   danger / success / warn            -> status text colours (used on light themes instead of red-400 etc.)
//   silhouette                         -> mosque silhouette in the 3D hero

export const DEFAULT_THEME = "night";
export const THEME_KEY = "siraj_theme";

export const THEMES = [
  {
    id: "night", mode: "dark", icon: "🌙",
    c: { bg: "#070B12", surface: "#0E1520", surface2: "#141D2B", border: "#1E2836", text: "#F2EFE9", textMuted: "#9AA5AE",
      gold: "#C9A24B", goldBright: "#E8C873", emerald: "#0F5132", emeraldBright: "#1E8F5E", onAccent: "#070B12",
      radial: "#101B2A", danger: "#F87171", success: "#34D399", warn: "#FCD34D", silhouette: "#04070D" },
  },
  {
    id: "emerald", mode: "dark", icon: "💚",
    c: { bg: "#04130E", surface: "#07211A", surface2: "#0C2D23", border: "#174536", text: "#E9F7F0", textMuted: "#8DB5A3",
      gold: "#22A66F", goldBright: "#4BD69C", emerald: "#0F5132", emeraldBright: "#34D399", onAccent: "#04130E",
      radial: "#0A2B20", danger: "#F87171", success: "#34D399", warn: "#FCD34D", silhouette: "#020A07" },
  },
  {
    id: "gold", mode: "dark", icon: "👑",
    c: { bg: "#110C03", surface: "#1B1406", surface2: "#261C09", border: "#44340F", text: "#FBF3DC", textMuted: "#C2B184",
      gold: "#D4A017", goldBright: "#FFD45E", emerald: "#0F5132", emeraldBright: "#3DB07A", onAccent: "#110C03",
      radial: "#2A1E08", danger: "#F87171", success: "#4ADE80", warn: "#FCD34D", silhouette: "#080500" },
  },
  {
    id: "glass", mode: "dark", icon: "🔮",
    c: { bg: "#0A1024", surface: "#141C3A", surface2: "#1C2750", border: "#3B4C85", text: "#F4F6FF", textMuted: "#B8C2E3",
      gold: "#67E8F9", goldBright: "#A5F3FC", emerald: "#0F5132", emeraldBright: "#5EEAD4", onAccent: "#06101F",
      radial: "#1E2A5E", danger: "#FCA5A5", success: "#5EEAD4", warn: "#FDE68A", silhouette: "#060A18" },
  },
  {
    id: "light", mode: "light", icon: "☀️",
    c: { bg: "#F5F7FA", surface: "#FFFFFF", surface2: "#E9EDF3", border: "#C5CEDA", text: "#151A22", textMuted: "#4B5563",
      gold: "#8A6516", goldBright: "#6E4F0C", emerald: "#0F5132", emeraldBright: "#0A6A3D", onAccent: "#FFFFFF",
      radial: "#FFFFFF", danger: "#B91C1C", success: "#046A4C", warn: "#92400E", silhouette: "#C9D1DC" },
  },
  {
    id: "cream", mode: "light", icon: "🍦",
    c: { bg: "#F6F0E1", surface: "#FBF7EC", surface2: "#EBE2C9", border: "#D0C196", text: "#2B2A26", textMuted: "#5A564A",
      gold: "#7E5A12", goldBright: "#664710", emerald: "#0F5132", emeraldBright: "#0A6A3D", onAccent: "#FFFFFF",
      radial: "#FDFAF0", danger: "#B91C1C", success: "#046A4C", warn: "#92400E", silhouette: "#DDD1B0" },
  },
  {
    id: "lightgold", mode: "light", icon: "✨",
    c: { bg: "#FFF4D1", surface: "#FFFAE8", surface2: "#FBE7A6", border: "#DDBE5C", text: "#33260A", textMuted: "#6B5514",
      gold: "#855F04", goldBright: "#6B4E04", emerald: "#0F5132", emeraldBright: "#0A6A3D", onAccent: "#FFFFFF",
      radial: "#FFFBEA", danger: "#B91C1C", success: "#046A4C", warn: "#92400E", silhouette: "#EBD28A" },
  },
  {
    id: "green", mode: "light", icon: "🌿",
    c: { bg: "#EDF7F0", surface: "#F8FCF9", surface2: "#D9EEDF", border: "#9FCBB0", text: "#10281A", textMuted: "#3E5E4B",
      gold: "#17693F", goldBright: "#0F5632", emerald: "#0F5132", emeraldBright: "#0A6A3D", onAccent: "#FFFFFF",
      radial: "#F8FCF9", danger: "#B91C1C", success: "#046A4C", warn: "#92400E", silhouette: "#BFDCC9" },
  },
  {
    id: "lightblue", mode: "light", icon: "🌊",
    c: { bg: "#EAF3FB", surface: "#F7FBFF", surface2: "#D5E6F6", border: "#9EC0E0", text: "#0E2236", textMuted: "#3F5E7C",
      gold: "#1B62B3", goldBright: "#0D4A94", emerald: "#0F5132", emeraldBright: "#0A6A3D", onAccent: "#FFFFFF",
      radial: "#F7FBFF", danger: "#B91C1C", success: "#046A4C", warn: "#92400E", silhouette: "#B7D0E8" },
  },
];

export const THEME_MAP = Object.fromEntries(THEMES.map((t) => [t.id, t]));
export const COLOR_KEYS = Object.keys(THEMES[0].c);

export function getTheme(id) {
  return THEME_MAP[id] || THEME_MAP[DEFAULT_THEME];
}

// "#C9A24B" -> "201 162 75"  (the format Tailwind needs for opacity like bg-noor-gold/40)
export function hexToTriplet(hex) {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(" ");
}

// Colours for the 3D hero scene (three.js cannot read CSS variables, so it gets plain hex strings).
export function threePalette(theme) {
  const c = theme.c;
  return {
    light: theme.mode === "light",
    accent: c.gold,
    bright: theme.mode === "light" ? c.goldBright : c.goldBright,
    third: c.emeraldBright,
    glassBody: c.surface,
    silhouette: c.silhouette,
  };
}
