import React, { Component, Suspense, lazy } from "react";
import { cardinal, normalize360 } from "../utils/qibla";
import { useI18n } from "../context/I18nContext";

const Compass3D = lazy(() => import("../three/Compass3D"));

/** Simple flat compass (CSS only): used on low-end devices, with reduced motion, or if 3D fails. */
function Compass2D({ qibla, heading, aligned }) {
  const { t } = useI18n();
  const dialRotation = -(heading ?? 0);
  const ring = aligned ? "border-emerald-400" : "border-noor-gold/60";
  return (
    <div className="relative mx-auto w-full max-w-[18rem] aspect-square">
      <div className={`absolute inset-0 rounded-full border-2 ${ring} bg-noor-surface2 shadow-glow`}
        style={{ transform: `rotate(${dialRotation}deg)`, transition: "transform 0.25s linear" }}>
        {[["N", 0], ["E", 90], ["S", 180], ["W", 270]].map(([d, deg]) => (
          <span key={d} className={`absolute left-1/2 top-1/2 text-sm font-bold ${d === "N" ? "text-red-400" : "text-noor-textMuted"}`}
            style={{ transform: `translate(-50%, -50%) rotate(${deg}deg) translateY(-6.2rem) rotate(${-deg}deg)` }}>{t(`dir.${d}`)}</span>
        ))}
        <div className="absolute inset-0" style={{ transform: `rotate(${qibla}deg)` }}>
          <div className={`absolute left-1/2 top-12 -translate-x-1/2 w-1.5 h-[38%] rounded-full ${aligned ? "bg-emerald-400" : "bg-gradient-to-b from-noor-goldBright to-noor-gold/20"}`} />
          <div className="absolute left-1/2 top-4 -translate-x-1/2 text-xl" aria-hidden="true">🕋</div>
        </div>
        <div className="absolute left-1/2 top-1/2 w-3 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-noor-gold" />
      </div>
      {/* fixed marker: the top of your phone */}
      <div className={`absolute left-1/2 -top-2 -translate-x-1/2 w-0 h-0 border-x-8 border-x-transparent border-t-[14px] ${aligned ? "border-t-emerald-400" : "border-t-noor-goldBright"}`} />
    </div>
  );
}

// If WebGL fails while drawing, show the simple compass instead of a blank page
export class Boundary extends Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFail && this.props.onFail(); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
  } catch (e) { return false; }
}

export default function CompassView({ mode, qibla, heading, headingRef, aligned, onFail }) {
  const { t } = useI18n();
  const flat = <Compass2D qibla={qibla} heading={heading} aligned={aligned} />;
  if (mode !== "3d") return flat;
  return (
    <div className="relative mx-auto w-full max-w-[22rem] aspect-square" role="img"
      aria-label={t("qibla.compassAria", { deg: Math.round(normalize360(qibla)), dir: t(`dir.${cardinal(qibla)}`) })}>
      <Boundary fallback={flat} onFail={onFail}>
        <Suspense fallback={<div className="w-full h-full animate-pulse rounded-full bg-noor-surface2" />}>
          <Compass3D qibla={qibla} headingRef={headingRef} aligned={aligned} />
        </Suspense>
      </Boundary>
    </div>
  );
}
