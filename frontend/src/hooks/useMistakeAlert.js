import { useEffect, useRef } from "react";
import { evaluate } from "../utils/mistakeAlerts.js";
import { mistakeSound } from "../services/mistakeSound.js";

/**
 * Plays the alert sound when the live recitation shows a mistake.
 *   live      result of alignLive() (changes many times per second while reciting)
 *   enabled   true while the sound is switched on AND the microphone is listening
 *   resetKey  change it (Surah / Ayah / "try again") and every word may beep again
 *   onAlert   called with the list of mistakes that just beeped: [{ index, kind }]
 */
export default function useMistakeAlert({ live, enabled, resetKey, onAlert }) {
  const pendingRef = useRef({});
  const alertedRef = useRef(new Set());
  const timerRef = useRef(null);
  const liveRef = useRef(live);
  const onAlertRef = useRef(onAlert);
  const runRef = useRef(null);
  liveRef.current = live;
  onAlertRef.current = onAlert;

  runRef.current = () => {
    clearTimeout(timerRef.current);
    if (!enabled || !liveRef.current) { pendingRef.current = {}; return; }
    const r = evaluate(liveRef.current, pendingRef.current, alertedRef.current, Date.now());
    pendingRef.current = r.pending;
    if (r.fire.length) {
      r.fire.forEach((m) => alertedRef.current.add(m.index));
      if (r.fire.some((m) => m.kind === "wrong")) mistakeSound.wrong(); else mistakeSound.close();
      if (onAlertRef.current) onAlertRef.current(r.fire);
    }
    if (r.wait !== null) timerRef.current = setTimeout(() => runRef.current(), r.wait + 20);
  };

  useEffect(() => { // a new Ayah (or a new try): forget what already beeped
    alertedRef.current = new Set();
    pendingRef.current = {};
    clearTimeout(timerRef.current);
  }, [resetKey]);

  useEffect(() => { runRef.current(); }, [live, enabled]);
  useEffect(() => () => clearTimeout(timerRef.current), []);
}
