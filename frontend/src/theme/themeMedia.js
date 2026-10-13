// Phase 36: every theme has its own full-screen background picture (public/media/bg/<name>.webp).
// <name>-sm.webp is a smaller copy for phones. To change a picture: replace the file, keep the name.
// THEME_BG is checked by a test, so a theme can never be added without a background.

export const BG_BASE = "/media/bg";
export const LOGO_FULL = "/media/siraj-logo.webp"; // 768 px (loading screen, hero)
export const LOGO_SMALL = "/media/siraj-logo-sm.webp"; // 256 px (navbar, footer)

export const THEME_BG = {
  night: "night",
  emerald: "emerald",
  gold: "gold",
  glass: "glass",
  light: "light",
  cream: "cream",
  lightgold: "lightgold",
  green: "green",
  lightblue: "lightblue",
};

export const FALLBACK_BG = "night";

// Every theme has its own logo colour (public/media/logo/<name>.webp, <name>-sm.webp for small places).
// "default" is the original green + gold logo (siraj-logo.webp). Same rule as the backgrounds: a theme can never miss a logo (tested).
export const THEME_LOGO = {
  night: "default",
  emerald: "default",
  green: "default",
  gold: "amber",
  lightgold: "amber",
  cream: "bronze",
  glass: "cyan",
  lightblue: "blue",
  light: "slate",
};

// small = true gives the 256 px copy (navbar, footer). Unknown theme -> original logo.
export function logoFile(themeId, small = false) {
  const name = THEME_LOGO[themeId] || "default";
  if (name === "default") return small ? LOGO_SMALL : LOGO_FULL;
  return `/media/logo/${name}${small ? "-sm" : ""}.webp`;
}

export function bgName(themeId) {
  return THEME_BG[themeId] || THEME_BG[FALLBACK_BG];
}

// small = true gives the phone-size copy
export function bgFile(themeId, small = false) {
  return `${BG_BASE}/${bgName(themeId)}${small ? "-sm" : ""}.webp`;
}

// Hero video (public/media/video). Three sizes: the page picks one by screen width.
export const HERO_VIDEOS = [
  { maxWidth: 640, src: "/media/video/hero-480.mp4" },
  { maxWidth: 1100, src: "/media/video/hero-720.mp4" },
  { maxWidth: Infinity, src: "/media/video/hero-1080.mp4" },
];
export const HERO_POSTER = "/media/video/hero-poster.webp";
export const HERO_POSTER_SMALL = "/media/video/hero-poster-sm.webp";

// Picks the video size for a screen width (CSS px). Returns "" when video should not be used at all.
export function pickHeroVideo(width, { saveData = false } = {}) {
  if (saveData) return "";
  const w = Number.isFinite(width) ? width : 1280;
  return (HERO_VIDEOS.find((v) => w <= v.maxWidth) || HERO_VIDEOS[HERO_VIDEOS.length - 1]).src;
}
