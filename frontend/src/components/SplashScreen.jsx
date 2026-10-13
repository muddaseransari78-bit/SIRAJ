import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useLocation } from "react-router-dom";
import { useI18n } from "../context/I18nContext";
import useLiteMode from "../hooks/useLiteMode";
import { logoFile } from "../theme/themeMedia";
import { useTheme } from "../context/ThemeContext";
import { splashPlan } from "../utils/splash";

// Phase 36 loading screen: the SIRAJ logo appears as a thick 3D slab that sways in the light, with golden
// rings turning around it and sparks rising behind it. When the site is ready the logo FLIES UP into the
// navbar (the navbar logo is hidden until it lands) and the screen fades away.
//
//  - Shows once per page load, never on normal link clicks, and never on /admin.
//  - Tap, click or press a key to skip it.
//  - Lite mode and "reduce motion" get a calm version (flat logo, short fade). It can never block the site:
//    a hard time limit closes it even if something does not finish loading.
const LAYERS = 9; // back copies of the logo that make the slab look thick

function Dust() {
  const items = useMemo(
    () => Array.from({ length: 16 }, (_, i) => ({
      x: `${(i * 37 + 11) % 100}%`,
      s: `${3 + ((i * 5) % 5)}px`,
      t: `${5 + ((i * 7) % 6)}s`,
      d: `${-((i * 13) % 9)}s`,
      dx: `${((i * 29) % 80) - 40}px`,
    })),
    []
  );
  return (
    <div className="splash-dust" aria-hidden="true">
      {items.map((it, i) => <span key={i} style={{ "--x": it.x, "--s": it.s, "--t": it.t, "--d": it.d, "--dx": it.dx }} />)}
    </div>
  );
}

function Logo3D({ fancy, leaving }) {
  const { themeId } = useTheme();
  const logoBig = logoFile(themeId);
  return (
    <motion.div
      className="splash-logo3d"
      initial={fancy ? { rotateY: -100, scale: 0.5, opacity: 0 } : { opacity: 0, scale: 0.9 }}
      animate={
        leaving
          ? { rotateY: 0, rotateX: 0, scale: 1, opacity: 1 }
          : fancy
            ? { rotateY: [-100, 24, -24, 24], rotateX: [18, -6, 6, -6], scale: 1, opacity: 1 }
            : { opacity: 1, scale: 1 }
      }
      transition={
        leaving
          ? { duration: 0.6, ease: "easeInOut" }
          : fancy
            ? { duration: 6, ease: "easeInOut", times: [0, 0.22, 0.6, 1], repeat: Infinity, repeatType: "mirror", opacity: { duration: 0.5 }, scale: { duration: 0.9, type: "spring", stiffness: 120, damping: 14 } }
            : { duration: 0.5 }
      }
    >
      {fancy && Array.from({ length: LAYERS }, (_, i) => (
        <img key={i} className="splash-layer" src={logoBig} alt="" draggable="false" style={{ "--i": i + 1 }} />
      ))}
      <img className="splash-face" src={logoBig} alt="" draggable="false" />
      {fancy && <span className="splash-shine" aria-hidden="true" />}
    </motion.div>
  );
}

export default function SplashScreen() {
  const { t } = useI18n();
  const { themeId } = useTheme();
  const logoBig = logoFile(themeId); // the loading screen shows the logo in the colour of the saved theme
  const { lite } = useLiteMode();
  const { pathname } = useLocation();
  const skipRoute = pathname.startsWith("/admin");
  const reduced = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const plan = splashPlan({ lite, reduced });

  const [phase, setPhase] = useState(skipRoute ? "done" : "loading"); // loading -> leaving -> done
  const [progress, setProgress] = useState(0);
  const [fly, setFly] = useState({ x: 0, y: -200, scale: 0.15 });
  const wrapRef = useRef(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const startedAt = useRef(typeof performance !== "undefined" ? performance.now() : 0);

  // lock scrolling and hide the navbar logo while the screen is up
  useEffect(() => {
    if (phase === "done") {
      delete document.documentElement.dataset.splash;
      return undefined;
    }
    document.documentElement.dataset.splash = "on";
    return () => { /* cleared when the phase becomes "done" */ };
  }, [phase]);
  useEffect(() => () => { delete document.documentElement.dataset.splash; }, []);

  const leave = useCallback(() => {
    if (phaseRef.current !== "loading") return;
    const el = wrapRef.current;
    const target = document.getElementById("nav-logo");
    if (el) {
      const a = el.getBoundingClientRect();
      const b = target ? target.getBoundingClientRect() : null;
      if (b && b.width > 0 && a.width > 0) {
        setFly({ x: b.left + b.width / 2 - (a.left + a.width / 2), y: b.top + b.height / 2 - (a.top + a.height / 2), scale: b.width / a.width });
      } else {
        setFly({ x: 0, y: -(a.top + a.height / 2) + 40, scale: 0.15 });
      }
    }
    setProgress(1);
    setPhase("leaving");
  }, []);

  // Wait for: a minimum time, the page load, the logo picture and the fonts. Never longer than plan.maxMs.
  useEffect(() => {
    if (phase !== "loading") return undefined;
    let cancelled = false;
    const ready = { load: document.readyState === "complete", logo: false, fonts: false };
    const check = () => {
      const elapsed = performance.now() - startedAt.current;
      if (!cancelled && ready.load && ready.logo && ready.fonts && elapsed >= plan.minMs) leave();
    };
    const onLoad = () => { ready.load = true; check(); };
    if (!ready.load) window.addEventListener("load", onLoad, { once: true });

    const img = new Image();
    img.src = logoBig;
    const logoDone = () => { ready.logo = true; check(); };
    if (img.decode) img.decode().then(logoDone, logoDone); else { img.onload = logoDone; img.onerror = logoDone; }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { ready.fonts = true; check(); }, () => { ready.fonts = true; check(); });
    else ready.fonts = true;

    // progress bar: eases towards 90% by itself, jumps to 100% when everything is ready
    const tick = setInterval(() => {
      const elapsed = performance.now() - startedAt.current;
      setProgress((p) => Math.max(p, Math.min(0.9, 1 - Math.exp(-elapsed / (plan.minMs * 0.55)))));
      check();
    }, 90);
    const hard = setTimeout(() => { if (!cancelled) leave(); }, plan.maxMs);

    return () => { cancelled = true; clearInterval(tick); clearTimeout(hard); window.removeEventListener("load", onLoad); };
  }, [phase, plan.minMs, plan.maxMs, leave]);

  // tap / click / any key skips (after a short moment so a stray touch does not skip it)
  useEffect(() => {
    if (phase !== "loading") return undefined;
    const skip = () => { if (performance.now() - startedAt.current > 700) leave(); };
    window.addEventListener("pointerdown", skip);
    window.addEventListener("keydown", skip);
    return () => { window.removeEventListener("pointerdown", skip); window.removeEventListener("keydown", skip); };
  }, [phase, leave]);

  // The logo lands on the navbar: at ~0.8s the navbar logo starts to fade in while the flying copy fades out
  useEffect(() => {
    if (phase !== "leaving") return undefined;
    const t1 = setTimeout(() => { document.documentElement.removeAttribute("data-splash"); }, 820);
    const t2 = setTimeout(() => setPhase("done"), 1200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [phase]);

  if (phase === "done") return null;
  const leaving = phase === "leaving";

  return (
    <motion.div
      className={`splash ${leaving ? "splash-leaving" : ""} ${plan.fancy ? "" : "splash-lite"}`}
      role="status"
      aria-live="polite"
      aria-label={t("splash.loading")}
    >
      <motion.div className="splash-bg" animate={{ opacity: leaving ? 0 : 1 }} transition={leaving ? { duration: 0.7, delay: 0.3, ease: "easeInOut" } : { duration: 0.2 }} />
      {plan.fancy && (
        <motion.div className="splash-dust-wrap" animate={{ opacity: leaving ? 0 : 1 }} transition={{ duration: 0.4 }}><Dust /></motion.div>
      )}

      <div className="splash-stage">
        {plan.fancy && !leaving && (
          <>
            <div className="splash-glow" aria-hidden="true" />
            <div className="splash-rings" aria-hidden="true"><i /><i /><i /></div>
          </>
        )}
        <motion.div
          ref={wrapRef}
          className="splash-logo-wrap"
          animate={leaving ? { x: fly.x, y: fly.y, scale: fly.scale, opacity: 0 } : { x: 0, y: 0, scale: 1, opacity: 1 }}
          transition={leaving
            ? { x: { duration: 1, ease: [0.65, 0, 0.25, 1] }, y: { duration: 1, ease: [0.65, 0, 0.25, 1] }, scale: { duration: 1, ease: [0.65, 0, 0.25, 1] }, opacity: { delay: 0.85, duration: 0.3 } }
            : { duration: 0.3 }}
          style={{ zIndex: 2 }}
        >
          <Logo3D fancy={plan.fancy} leaving={leaving} />
        </motion.div>
      </div>

      <motion.div className="splash-meta" animate={{ opacity: leaving ? 0 : 1, y: leaving ? 16 : 0 }} transition={{ duration: 0.4 }}>
        <motion.h2
          className="splash-title no-halo"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.7 }}
          dir="ltr"
        >
          SIRAJ
        </motion.h2>
        <motion.p className="splash-tag" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7, duration: 0.8 }}>
          {t("brand.tagline")}
        </motion.p>
        <div className="splash-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
          <motion.i animate={{ scaleX: progress }} initial={{ scaleX: 0 }} transition={{ duration: 0.3, ease: "easeOut" }} />
        </div>
        <p className="splash-skip">{t("splash.skip")}</p>
      </motion.div>
    </motion.div>
  );
}
