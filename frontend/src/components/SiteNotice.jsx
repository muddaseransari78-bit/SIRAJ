import React, { useLayoutEffect, useRef, useState } from "react";
import usePublicSettings from "../hooks/usePublicSettings";

const SPEED = 70; // pixels per second - readable, not too fast

// Banner for the message an admin writes in Admin -> Settings. Plain text only (never HTML).
// The message slides in from the RIGHT, crosses the screen and leaves on the LEFT, then starts again.
// Hover / touch / keyboard focus pauses it so it can be read. Reduced motion and Lite mode show it as still text.
export default function SiteNotice() {
  const { settings } = usePublicSettings();
  const text = settings.siteNotice;
  const boxRef = useRef(null);
  const textRef = useRef(null);
  const [duration, setDuration] = useState(20);

  // Run time = distance (screen width + text width) / speed, so long and short messages move at the same pace
  useLayoutEffect(() => {
    if (!text) return undefined;
    const measure = () => {
      if (!boxRef.current || !textRef.current) return;
      const dist = boxRef.current.clientWidth + textRef.current.offsetWidth;
      setDuration(Math.max(8, dist / SPEED));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [text]);

  if (!text) return null;
  return (
    <div
      ref={boxRef}
      role="status"
      dir="ltr"
      className="site-notice bg-noor-gold text-noor-onAccent text-sm py-2"
      tabIndex={0}
      aria-label={text}
    >
      <div className="site-notice-track" style={{ animationDuration: `${duration}s` }} aria-hidden="true">
        <span ref={textRef} dir="auto" className="site-notice-text">{text}</span>
      </div>
      {/* Still copy used only when motion is switched off (reduced motion / Lite mode) */}
      <p className="site-notice-still px-4 text-center" dir="auto">{text}</p>
    </div>
  );
}
