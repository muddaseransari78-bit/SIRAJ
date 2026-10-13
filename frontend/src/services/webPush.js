// Phase 31 - browser side of background reminders (Web Push).
// The server (backend/services/pushService.js) sends a reminder at prayer / Jamaat time and the service worker
// (public/sw.js) shows it - even when SIRAJ is closed or minimized.
import api from "./api";

/** "ok" | "unsupported" | "insecure" (push needs https; localhost is fine) | "needs-install" (iPhone: Add to Home Screen) */
export function pushSupport() {
  if (typeof window === "undefined") return "unsupported";
  if (!window.isSecureContext) return "insecure";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || typeof Notification === "undefined") {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent || "");
    return ios ? "needs-install" : "unsupported";
  }
  return "ok";
}

/** VAPID public key (URL-safe base64) -> the bytes the browser wants. */
export function urlBase64ToUint8Array(base64) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function registration() {
  if (!("serviceWorker" in navigator)) return null;
  // The service worker is only registered in the production build (see main.jsx). Do not wait forever without it.
  const existing = await navigator.serviceWorker.getRegistration();
  if (!existing) return null;
  return navigator.serviceWorker.ready;
}

export function deviceTimeZone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) { return ""; }
}

/** Ask the server whether it has the VAPID keys: { enabled, publicKey } */
export async function fetchPushKey() {
  return (await api.get("/prayer/push/key")).data.data;
}

/** Is THIS browser subscribed? Returns the browser subscription or null. */
export async function currentSubscription() {
  try {
    const reg = await registration();
    return reg ? await reg.pushManager.getSubscription() : null;
  } catch (e) { return null; }
}

/**
 * Turn background reminders on for this device. `place` = { latitude, longitude } or { city, country }.
 * Returns { ok: true } or { ok: false, reason } with a message that is safe to show.
 */
export async function enablePush(place) {
  const support = pushSupport();
  if (support === "insecure") return { ok: false, code: "insecure", reason: "Alerts when closed need a secure (https) address." };
  if (support === "needs-install") return { ok: false, code: "install", reason: "On iPhone / iPad: tap Share, choose Add to Home Screen, then open SIRAJ from the Home Screen icon." };
  if (support !== "ok") return { ok: false, code: "unsupported", reason: "This browser cannot show alerts when SIRAJ is closed." };
  if (Notification.permission !== "granted") return { ok: false, code: "permission", reason: "Please allow notifications first." };
  if (!place) return { ok: false, code: "place", reason: "Please choose your location first." };

  const reg = await registration();
  if (!reg) return { ok: false, code: "nosw", reason: "Please reload the page once and try again." };

  let key;
  try { key = await fetchPushKey(); } catch (e) { return { ok: false, code: "network", reason: "Could not reach the server. Please try again." }; }
  if (!key.enabled || !key.publicKey) return { ok: false, code: "nokey", reason: "Alerts when closed are not available on this site right now." };

  try {
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key.publicKey) });
    }
    const json = sub.toJSON();
    await api.post("/prayer/push/subscribe", { subscription: { endpoint: json.endpoint, keys: json.keys }, timezone: deviceTimeZone(), ...place });
    return { ok: true };
  } catch (e) {
    const msg = e && e.response && e.response.data && e.response.data.message;
    return { ok: false, code: "failed", reason: msg || "Could not turn on alerts when closed on this device." };
  }
}

/** Turn background reminders off for this device (browser + server). */
export async function disablePush() {
  try {
    const sub = await currentSubscription();
    if (sub) {
      const endpoint = sub.endpoint;
      await sub.unsubscribe();
      await api.post("/prayer/push/unsubscribe", { endpoint }).catch(() => {});
    }
    return true;
  } catch (e) { return false; }
}

/** Ask the server to push a test notification to the logged-in user's devices. */
export async function sendTestPush() {
  try {
    await api.post("/prayer/push/test");
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: (e.response && e.response.data && e.response.data.message) || "Could not send the test." };
  }
}
