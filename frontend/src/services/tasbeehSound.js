// Small tick / chime sounds for the Tasbeeh. ONE shared AudioContext is reused for every tap
// (creating a new one per tap leaks audio resources and browsers stop playing after a few).
let ctx = null;

function getContext() {
  if (ctx) return ctx;
  const Ctor = typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext);
  if (!Ctor) return null;
  try { ctx = new Ctor(); } catch (e) { ctx = null; }
  return ctx;
}

function blip(frequency, duration, volume) {
  const c = getContext();
  if (!c) return;
  if (c.state === "suspended") c.resume().catch(() => {});
  try {
    const osc = c.createOscillator();
    const gain = c.createGain();
    const now = c.currentTime;
    osc.type = "sine";
    osc.frequency.value = frequency;
    // quick fade-out avoids the "click" at the end of a sound
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  } catch (e) { /* sound is optional */ }
}

export const tasbeehSound = {
  tick() { blip(660, 0.06, 0.06); },
  chime() { blip(880, 0.35, 0.09); setTimeout(() => blip(1175, 0.45, 0.07), 140); },
};
