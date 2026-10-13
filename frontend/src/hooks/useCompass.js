import { useCallback, useEffect, useRef, useState } from "react";
import { applyCorrection, headingFromEvent, smoothHeading } from "../utils/qibla";

/**
 * Live device compass.
 * status: "idle" | "asking" | "waiting" | "active" | "denied" | "unavailable"
 * - headingRef.current : smoothed heading, updated on every sensor event (for the 3D scene, no re-render)
 * - heading            : the same value as React state, updated about 8 times per second (for text)
 * start() MUST be called from a click (iPhone asks for permission only after a tap).
 */
export default function useCompass(correction = 0) {
  const [status, setStatus] = useState("idle");
  const [heading, setHeading] = useState(null);
  const headingRef = useRef(null);
  const lastPush = useRef(0);
  const cleanup = useRef(null);
  const timer = useRef(null);
  const rawRef = useRef(null);            // smoothed reading WITHOUT the user's correction
  const correctionRef = useRef(correction);
  correctionRef.current = correction;

  const stop = useCallback(() => {
    if (cleanup.current) { cleanup.current(); cleanup.current = null; }
    clearTimeout(timer.current);
    headingRef.current = null;
    rawRef.current = null;
    setHeading(null);
    setStatus("idle");
  }, []);

  const start = useCallback(async () => {
    if (cleanup.current) return;
    if (typeof window === "undefined" || typeof DeviceOrientationEvent === "undefined") {
      setStatus("unavailable");
      return;
    }
    try {
      if (typeof DeviceOrientationEvent.requestPermission === "function") { // iOS 13+
        setStatus("asking");
        const res = await DeviceOrientationEvent.requestPermission();
        if (res !== "granted") { setStatus("denied"); return; }
      }
    } catch (e) {
      setStatus("denied");
      return;
    }

    let gotReading = false;
    const onEvent = (e) => {
      const h = headingFromEvent(e);
      if (h == null) return;
      gotReading = true;
      rawRef.current = smoothHeading(rawRef.current, h, 0.25);
      headingRef.current = applyCorrection(rawRef.current, correctionRef.current);
      const now = Date.now();
      if (now - lastPush.current > 120) {
        lastPush.current = now;
        setHeading(headingRef.current);
        setStatus("active");
      }
    };
    window.addEventListener("deviceorientationabsolute", onEvent, true);
    window.addEventListener("deviceorientation", onEvent, true);
    cleanup.current = () => {
      window.removeEventListener("deviceorientationabsolute", onEvent, true);
      window.removeEventListener("deviceorientation", onEvent, true);
    };
    setStatus("waiting");
    // Desktop browsers have no compass: say so instead of waiting forever
    timer.current = setTimeout(() => { if (!gotReading) { stop(); setStatus("unavailable"); } }, 3000);
  }, [stop]);

  useEffect(() => () => { if (cleanup.current) cleanup.current(); clearTimeout(timer.current); }, []);

  return { status, heading, headingRef, start, stop };
}
