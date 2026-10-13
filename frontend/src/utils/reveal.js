// Pure helpers for hooks/useScrollReveal.js (kept free of React so they are easy to test).
export const REVEAL_SELECTOR = [
  "main .glass-card",
  "main h1",
  "main h2",
  "main [data-reveal]",
].join(",");

const MAX_STAGGER = 6; // card number 7, 8, 9 ... appear without extra delay
const STEP_MS = 80;

export function revealDelay(indexInGroup) {
  return Math.min(Math.max(indexInGroup, 0), MAX_STAGGER) * STEP_MS;
}

