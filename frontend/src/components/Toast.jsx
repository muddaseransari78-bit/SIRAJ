import React, { useCallback, useRef, useState } from "react";

// Tiny toast helper: const { toastEl, notify } = useToast();  notify("Saved");
export function useToast() {
  const [message, setMessage] = useState("");
  const timer = useRef(null);

  const notify = useCallback((text) => {
    setMessage(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(""), 2500);
  }, []);

  const toastEl = message ? (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-noor-gold text-noor-onAccent text-sm shadow-glow"
    >
      {message}
    </div>
  ) : null;

  return { toastEl, notify };
}
