import { useEffect } from "react";
import useLiteMode from "./useLiteMode";
import { REVEAL_SELECTOR, revealDelay } from "../utils/reveal";

// Phase 36: things fade and rise into place as you scroll down any page.
// Used once in MainLayout, so EVERY page gets it (cards, headings, lists) without editing each page.
//
// How it stays safe:
//  - Only elements that are still BELOW the screen are hidden; whatever you can already see is never hidden.
//  - If anything goes wrong (no IntersectionObserver, Lite mode, reduced motion) nothing is hidden at all.
//  - After an element has appeared the helper classes are removed again, so hover effects work normally.
//  - If React re-renders an element and drops the helper class, the element just becomes visible (never stuck hidden).
//
// Opt out for one element: add data-no-reveal. Pick a direction: data-reveal="left|right|zoom".
export default function useScrollReveal(rootSelector = "main") {
  const { lite } = useLiteMode();

  useEffect(() => {
    if (lite || typeof window === "undefined" || typeof IntersectionObserver === "undefined") return undefined;
    const root = document.querySelector(rootSelector);
    if (!root) return undefined;

    const timers = new Set();
    const seen = new WeakSet();

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target;
          io.unobserve(el);
          el.classList.add("rv-in");
          const id = setTimeout(() => {
            timers.delete(id);
            el.classList.remove("rv", "rv-in", "rv-left", "rv-right", "rv-zoom");
            el.style.removeProperty("--rv-d");
          }, 1300);
          timers.add(id);
        }
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0.06 }
    );

    function scan() {
      let nodes;
      try { nodes = root.querySelectorAll(REVEAL_SELECTOR); } catch { return; }
      const vh = window.innerHeight || 800;
      const groups = new Map(); // parent -> how many we already queued in it
      nodes.forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);
        if (el.closest("[data-no-reveal]") || el.hasAttribute("data-no-reveal")) return;
        const top = el.getBoundingClientRect().top;
        if (top < vh * 0.94) return; // already on screen: leave it alone
        const parent = el.parentElement;
        const n = groups.get(parent) || 0;
        groups.set(parent, n + 1);
        el.classList.add("rv");
        const dir = el.getAttribute("data-reveal");
        if (dir === "left" || dir === "right" || dir === "zoom") el.classList.add(`rv-${dir}`);
        el.style.setProperty("--rv-d", `${revealDelay(n)}ms`);
        io.observe(el);
      });
    }

    let raf = 0;
    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = 0; scan(); });
    };
    scan();
    const mo = new MutationObserver(schedule);
    mo.observe(root, { childList: true, subtree: true });

    return () => {
      mo.disconnect();
      io.disconnect();
      if (raf) cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      // leave the page fully visible
      root.querySelectorAll(".rv").forEach((el) => el.classList.remove("rv", "rv-in", "rv-left", "rv-right", "rv-zoom"));
    };
  }, [lite, rootSelector]);
}
