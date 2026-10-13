// Alert sounds for live recitation mistakes. Made with the Web Audio API, so no sound file is needed.
//  wrong()  - three short falling beeps (a different word / a skipped word / a wrong zabar-zer-pesh)
//  close()  - one soft tick (a word that was only almost right)
// ONE shared AudioContext is reused. Browsers only allow sound after a click, so call unlock() inside the
// "Start reciting" click handler.
const KEY = "siraj.mistakeSound";
let ctx = null;

function getContext() {
  if (ctx) return ctx;
  const Ctor = typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext);
  if (!Ctor) return null;
  try { ctx = new Ctor(); } catch (e) { ctx = null; }
  return ctx;
}

export function unlock() {
  const c = getContext();
  if (c && c.state === "suspended") c.resume().catch(() => {});
}

function tone(frequency, delay, duration, volume, type) {
  const c = getContext();
  if (!c) return;
  if (c.state === "suspended") c.resume().catch(() => {});
  try {
    const osc = c.createOscillator();
    const gain = c.createGain();
    const start = c.currentTime + delay;
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration); // fade-out avoids a click
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  } catch (e) { /* the sound is optional */ }
}

function vibrate(pattern) {
  try { if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(pattern); } catch (e) { /* optional */ }
}

export const mistakeSound = {
  wrong() {
    tone(740, 0, 0.16, 0.16, "sawtooth");
    tone(740, 0.2, 0.16, 0.16, "sawtooth");
    tone(494, 0.4, 0.28, 0.16, "sawtooth");
    vibrate([150, 70, 150, 70, 250]);
  },
  close() {
    tone(660, 0, 0.12, 0.08, "sine");
    vibrate(60);
  },
};

export function loadAlertPref() {
  try { return localStorage.getItem(KEY) !== "off"; } catch (e) { return true; } // ON by default
}
export function saveAlertPref(on) {
  try { localStorage.setItem(KEY, on ? "on" : "off"); } catch (e) { /* ignore */ }
}
