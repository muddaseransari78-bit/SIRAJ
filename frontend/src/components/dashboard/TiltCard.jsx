import React, { useRef } from "react";
import { currentlyLite } from "../../hooks/useLiteMode";

// A glass card that leans slightly towards the pointer (the "3D card" feel).
// Switched off for touch screens, for people who prefer reduced motion, and in Lite mode.
const canTilt = () =>
  typeof window !== "undefined" &&
  window.matchMedia &&
  window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
  !currentlyLite(); // Lite mode (footer switch, weak device, Data Saver) also turns the lean effect off

export default function TiltCard({ children, className = "", max = 5, ...props }) {
  const ref = useRef(null);

  const onMove = (e) => {
    if (!canTilt() || !ref.current) return;
    const box = ref.current.getBoundingClientRect();
    const x = (e.clientX - box.left) / box.width - 0.5;
    const y = (e.clientY - box.top) / box.height - 0.5;
    ref.current.style.transform = `perspective(900px) rotateX(${(-y * max).toFixed(2)}deg) rotateY(${(x * max).toFixed(2)}deg) translateZ(0)`;
  };
  const onLeave = () => { if (ref.current) ref.current.style.transform = ""; };

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className={`glass-card p-5 transition-[transform,box-shadow] duration-200 ease-out hover:shadow-glow ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
