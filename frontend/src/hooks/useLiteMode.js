import { useCallback, useEffect, useSyncExternalStore } from "react";
import { browserEnv, isLiteMode, readPreference, writePreference } from "../utils/devicePerf";

// Tiny shared store so every component (Home, Qibla, Tasbeeh, Footer) sees the same value instantly.
const listeners = new Set();
let preference = typeof localStorage !== "undefined" ? readPreference(localStorage) : "auto";
let tick = 0; // goes up when the OS "reduce motion" setting changes, so components re-check

function notify() { tick += 1; listeners.forEach((fn) => fn()); }
function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function getSnapshot() { return `${preference}:${tick}`; }
function setPreference(value) {
  preference = value;
  writePreference(localStorage, value);
  notify();
}

// const { lite, preference, setPreference } = useLiteMode();
// lite = true  -> skip 3D scenes and blur effects.
export default function useLiteMode() {
  useSyncExternalStore(subscribe, getSnapshot, () => "auto:0");
  const lite = isLiteMode(preference, browserEnv());

  // <html data-lite="true"> lets CSS switch off the expensive effects (see index.css)
  useEffect(() => {
    document.documentElement.dataset.lite = lite ? "true" : "false";
  }, [lite]);

  // If the person changes the OS "reduce motion" setting while the site is open, re-check.
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    mq.addEventListener("change", notify);
    return () => mq.removeEventListener("change", notify);
  }, []);

  const set = useCallback((value) => setPreference(value), []);
  return { lite, preference, setPreference: set };
}

// For non-React code (e.g. the first value of a useState initializer).
export function currentlyLite() {
  return isLiteMode(preference, browserEnv());
}
