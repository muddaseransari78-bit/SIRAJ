import { useEffect, useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";

// Every time a new page opens (any button, link, menu item, logo, back/forward) it starts at the TOP.
// - Without this the browser keeps the old scroll position, so a new page could open half-way down.
// - If the address has a #section part, we leave it alone so the page can jump to that section.
// - Pressing a link that points to the page you are already on also takes you back to the top.
export default function ScrollToTop() {
  const { pathname, hash } = useLocation();

  // We handle the position ourselves (browser "restore" would bring back the old scroll on Back)
  useEffect(() => {
    if ("scrollRestoration" in window.history) window.history.scrollRestoration = "manual";
  }, []);

  useLayoutEffect(() => {
    if (hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname, hash]);

  // Same-page link (e.g. tapping "Home" while already on Home) -> back to the top
  useEffect(() => {
    function onClick(e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest && e.target.closest("a[href]");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      let url;
      try { url = new URL(a.href, window.location.href); } catch { return; }
      if (url.origin === window.location.origin && url.pathname === window.location.pathname && !url.hash) {
        window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
      }
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return null;
}
