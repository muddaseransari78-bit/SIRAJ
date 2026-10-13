import React, { useRef, useState } from "react";
import { Loader2 } from "lucide-react";

// The main gold button. Raised like a key; when pressed it sinks into the card (CSS .btn-3d),
// and a soft ripple spreads from the exact spot you pressed. Shows a spinner while `loading`.
export default function PressButton({ loading = false, children, className = "", onPointerDown, ...props }) {
  const [dots, setDots] = useState([]);
  const idRef = useRef(0);

  function handleDown(e) {
    if (!loading && !props.disabled) {
      const box = e.currentTarget.getBoundingClientRect();
      const id = (idRef.current += 1);
      setDots((list) => [...list.slice(-3), { id, x: e.clientX - box.left, y: e.clientY - box.top }]);
    }
    if (onPointerDown) onPointerDown(e);
  }

  return (
    <button className={`btn-3d ${className}`} aria-busy={loading || undefined} onPointerDown={handleDown} {...props}>
      {dots.map((d) => (
        <span
          key={d.id}
          aria-hidden="true"
          className="btn-ripple-dot"
          style={{ left: d.x, top: d.y }}
          onAnimationEnd={() => setDots((list) => list.filter((i) => i.id !== d.id))}
        />
      ))}
      <span className="btn-label">
        {loading && <Loader2 size={18} className="animate-spin" aria-hidden="true" />}
        {children}
      </span>
    </button>
  );
}
