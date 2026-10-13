import { useEffect, useState } from "react";
import { fetchPublicSettings } from "../services/contentService";

// Website settings an admin can change (site notice, Ramadan on/off, sign-ups on/off).
// Fetched once per page load and shared by every component. If the request fails the website simply
// behaves as "everything on, no notice".
const DEFAULTS = { registrationEnabled: true, ramadanEnabled: true, siteNotice: "" };
let promise = null;

export default function usePublicSettings() {
  const [settings, setSettings] = useState(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!promise) promise = fetchPublicSettings().catch(() => { promise = null; return DEFAULTS; });
    promise.then((s) => { if (alive) { setSettings({ ...DEFAULTS, ...s }); setReady(true); } });
    return () => { alive = false; };
  }, []);

  return { settings, ready };
}
