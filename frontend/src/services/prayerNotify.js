// Browser side of prayer reminders: showing a notification and playing the Adhan.
// Kept separate from React so the same code can be reused in a future mobile app wrapper.

export function notificationSupport() {
  if (typeof window === "undefined" || typeof Notification === "undefined") return "unsupported";
  if (!window.isSecureContext) return "insecure"; // notifications need https (localhost is fine)
  return "ok";
}

/** "granted" | "denied" | "default" | "unsupported" */
export function currentPermission() {
  return typeof Notification === "undefined" ? "unsupported" : Notification.permission;
}

/** Must be called from a click. Returns the new permission. */
export async function askPermission() {
  if (typeof Notification === "undefined") return "unsupported";
  if (Notification.permission !== "default") return Notification.permission;
  try { return await Notification.requestPermission(); } catch (e) { return Notification.permission; }
}

/**
 * Shows a notification. Uses the service worker when there is one (needed on Android Chrome,
 * where `new Notification()` is not allowed) and falls back to the normal API (npm run dev).
 */
export async function showPrayerNotification({ title, body, tag, url }) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return false;
  const options = {
    body, tag, renotify: true,
    icon: "/icons/icon-192.png", badge: "/icons/icon-192.png",
    data: { url: url || "/prayer" },
  };
  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) { await reg.showNotification(title, options); return true; }
    }
  } catch (e) { /* try the normal way below */ }
  try { new Notification(title, options); return true; } catch (e) { return false; }
}

// ---------- Adhan ----------
let audio = null;
let playing = false;
const listeners = new Set();
function setPlaying(v) { playing = v; listeners.forEach((fn) => fn(v)); }

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 660;
    gain.gain.value = 0.15;
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.6);
    osc.onended = () => { setPlaying(false); ctx.close(); };
    setPlaying(true);
  } catch (e) { setPlaying(false); }
}

export const adhanPlayer = {
  /** Plays /adhan/adhan.mp3 (you add this file yourself). If it is missing or blocked: a short beep. */
  play() {
    this.stop();
    try {
      audio = new Audio("/adhan/adhan.mp3");
      let fellBack = false;
      const fallback = () => { if (!fellBack) { fellBack = true; audio = null; beep(); } };
      audio.onerror = fallback;
      audio.onended = () => setPlaying(false);
      setPlaying(true);
      audio.play().catch(fallback);
    } catch (e) { beep(); }
  },
  stop() {
    if (audio) { audio.pause(); audio.onerror = null; audio.onended = null; audio = null; }
    setPlaying(false);
  },
  isPlaying: () => playing,
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
};
