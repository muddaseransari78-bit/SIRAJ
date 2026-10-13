import { useCallback, useEffect, useState } from "react";

// Tells a 3D canvas whether it is worth drawing right now (Phase 21 - polish + battery).
// A scene is "active" only when it is on screen AND the browser tab is in front.
// Use:  const [watch, active] = useCanvasActive();
//       <div ref={watch}> ... <Canvas frameloop={active ? "always" : "never"} />
//   or  <Canvas onCreated={({ gl }) => watch(gl.domElement)} frameloop={active ? "always" : "never"} />
export default function useCanvasActive() {
  const [element, setElement] = useState(null);
  const [onScreen, setOnScreen] = useState(true);
  const [tabShown, setTabShown] = useState(typeof document === "undefined" ? true : document.visibilityState !== "hidden");

  useEffect(() => {
    if (!element || typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), { threshold: 0.05 });
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);

  useEffect(() => {
    const onVisibility = () => setTabShown(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const watch = useCallback((node) => setElement(node), []);
  return [watch, onScreen && tabShown];
}
