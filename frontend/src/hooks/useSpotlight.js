import { useEffect } from "react";

// Lets every ".fx-card" inside `ref` glow where the pointer is (CSS reads --mx / --my).
// One listener for the whole page area, not one per card. Only on devices with a real mouse.
export default function useSpotlight(ref) {
  useEffect(() => {
    const root = ref.current;
    if (!root || typeof window === "undefined" || !window.matchMedia) return undefined;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return undefined;

    let raf = 0;
    let last = null;
    const onMove = (e) => {
      const card = e.target && e.target.closest ? e.target.closest(".fx-card") : null;
      if (!card) return;
      last = { card, x: e.clientX, y: e.clientY };
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (!last) return;
        const box = last.card.getBoundingClientRect();
        last.card.style.setProperty("--mx", `${last.x - box.left}px`);
        last.card.style.setProperty("--my", `${last.y - box.top}px`);
      });
    };
    root.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      root.removeEventListener("pointermove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [ref]);
}
