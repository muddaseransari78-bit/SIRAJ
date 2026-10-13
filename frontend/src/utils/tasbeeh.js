// Tasbeeh logic without React or browser APIs, so it can be unit-tested.

export const MAX_COUNT = 1000000;
export const MAX_TARGET = 100000;
export const PRESET_TARGETS = [33, 99, 100];
export const BEADS = 33; // beads drawn in the 3D ring (a normal tasbeeh has 33 or 99)
export const CUSTOM_ID = "custom";

// Common short dhikr. Counts like 33 are customary after Salah; the user can choose any target.
export const DHIKR = [
  { id: "subhanallah", ar: "سُبْحَانَ اللَّهِ", en: "SubhanAllah" },
  { id: "alhamdulillah", ar: "الْحَمْدُ لِلَّهِ", en: "Alhamdulillah" },
  { id: "allahuakbar", ar: "اللَّهُ أَكْبَرُ", en: "Allahu Akbar" },
  { id: "astaghfirullah", ar: "أَسْتَغْفِرُ اللَّهَ", en: "Astaghfirullah" },
  { id: "lailaha", ar: "لَا إِلَهَ إِلَّا اللَّهُ", en: "La ilaha illallah" },
  { id: "bihamdihi", ar: "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ", en: "SubhanAllahi wa bihamdihi" },
];

export const DEFAULT_STATE = {
  dhikrId: "subhanallah",
  customText: "",          // text of the user's own dhikr
  counts: {},              // { dhikrId: number } - each dhikr keeps its own count
  target: 33,
  vibrate: true,
  sound: false,
  daily: { date: "", total: 0 }, // taps counted today on THIS device (works without an account)
};

/** Whole number from 1 to MAX_TARGET; anything else -> `fallback`. */
export function clampTarget(value, fallback = 33) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(MAX_TARGET, n);
}

/** Rounds finished, position inside the current round and 0-100 progress of the round. */
export function progressOf(count, target) {
  const t = clampTarget(target);
  const c = Math.max(0, Math.floor(Number(count)) || 0);
  const rounds = Math.floor(c / t);
  const inRound = c % t;
  // exactly at the end of a round the ring shows "full" (100%) instead of snapping back to empty
  const pct = c === 0 ? 0 : inRound === 0 ? 100 : Math.round((inRound / t) * 100);
  return { rounds, inRound, pct, justCompleted: c > 0 && inRound === 0 };
}

/** How many of the 33 drawn beads are lit gold for this count. */
export function litBeads(count, target) {
  const { pct } = progressOf(count, target);
  return Math.round((pct / 100) * BEADS);
}

/** Makes saved/unknown data safe to use (old version, edited by hand, broken JSON ...). */
export function sanitizeState(raw, today) {
  const s = raw && typeof raw === "object" ? raw : {};
  const known = DHIKR.some((d) => d.id === s.dhikrId) || s.dhikrId === CUSTOM_ID;
  const counts = {};
  if (s.counts && typeof s.counts === "object") {
    Object.keys(s.counts).forEach((id) => {
      const n = Math.floor(Number(s.counts[id]));
      if ((DHIKR.some((d) => d.id === id) || id === CUSTOM_ID) && Number.isFinite(n) && n > 0) counts[id] = Math.min(n, MAX_COUNT);
    });
  }
  const daily = s.daily && s.daily.date === today && Number.isFinite(Number(s.daily.total)) ? { date: today, total: Math.max(0, Math.floor(Number(s.daily.total))) } : { date: today, total: 0 };
  return {
    dhikrId: known ? s.dhikrId : DEFAULT_STATE.dhikrId,
    customText: typeof s.customText === "string" ? s.customText.slice(0, 60) : "",
    counts,
    target: clampTarget(s.target, 33),
    vibrate: s.vibrate !== false,
    sound: s.sound === true,
    daily,
  };
}

/** One tap (+1) for the selected dhikr. Also counts it in today's device total. */
export function addTap(state, today) {
  const id = state.dhikrId;
  const current = state.counts[id] || 0;
  if (current >= MAX_COUNT) return state;
  const daily = state.daily.date === today ? state.daily : { date: today, total: 0 };
  return { ...state, counts: { ...state.counts, [id]: current + 1 }, daily: { date: today, total: daily.total + 1 } };
}

/** Undo one tap (never below 0). Also takes it out of today's total. */
export function undoTap(state, today) {
  const id = state.dhikrId;
  const current = state.counts[id] || 0;
  if (current <= 0) return state;
  const daily = state.daily.date === today ? state.daily : { date: today, total: 0 };
  return { ...state, counts: { ...state.counts, [id]: current - 1 }, daily: { date: today, total: Math.max(0, daily.total - 1) } };
}

/** Sets the selected dhikr's count back to 0 (today's total is kept: those were real recitations). */
export function resetCount(state) {
  const counts = { ...state.counts };
  delete counts[state.dhikrId];
  return { ...state, counts };
}

/** The name saved with a session. */
export function dhikrLabel(state) {
  if (state.dhikrId === CUSTOM_ID) return state.customText.trim() || "Custom dhikr";
  const found = DHIKR.find((d) => d.id === state.dhikrId);
  return found ? found.en : "Dhikr";
}
