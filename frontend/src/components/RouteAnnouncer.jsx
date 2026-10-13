import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

// Screen-reader + keyboard help for a single-page app (Phase 20 - accessibility).
// In a normal website every link loads a new page, so the screen reader says the page title and
// keyboard focus goes back to the top. React Router does NOT do that, so we do it here:
//  1. after each page change, announce the page title in a hidden live region
//  2. move keyboard focus to <main> (so the next Tab starts inside the new page, not in the old navbar)
// The very first page load is skipped (the browser already handles it).
export default function RouteAnnouncer({ mainId = "main-content" }) {
  const { pathname } = useLocation();
  const first = useRef(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (first.current) { first.current = false; return undefined; }

    // MainLayout updates document.title in its own effect; wait a moment so we read the NEW title.
    const timer = setTimeout(() => {
      setMessage(document.title.replace(/\s*🕯️\s*/g, " ").trim());
      const main = document.getElementById(mainId);
      if (main) main.focus({ preventScroll: true });
    }, 120);
    return () => clearTimeout(timer);
  }, [pathname, mainId]);

  return (
    <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </p>
  );
}
