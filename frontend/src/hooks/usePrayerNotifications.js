import { useEffect, useRef } from "react";
import { dueEvents } from "../utils/prayerSchedule";
import { showPrayerNotification, adhanPlayer } from "../services/prayerNotify";

export { PRAYERS } from "../utils/prayerSchedule";

const FIRED_KEY = "siraj_fired_reminders";

function loadFired() {
  try { return new Set(JSON.parse(localStorage.getItem(FIRED_KEY) || "[]")); } catch (e) { return new Set(); }
}
function saveFired(set) {
  try {
    // keep the list short: only the latest 40 keys
    localStorage.setItem(FIRED_KEY, JSON.stringify([...set].slice(-40)));
  } catch (e) { /* ignore */ }
}

/**
 * Fires reminders from a list of events (see utils/prayerSchedule.js buildSchedule).
 * It checks every 10 seconds instead of one long setTimeout per prayer, because browsers delay
 * timers in background tabs and a laptop that went to sleep would otherwise miss them.
 * Each event fires once (remembered in localStorage, so two open tabs do not both fire it).
 * Works ONLY while SIRAJ is open in a browser tab. For reminders when SIRAJ is closed see services/webPush.js
 * (the server pushes them). `serverPush` = this device is registered for them: the page then does NOT show the
 * notification itself (the server one would be a duplicate) but still plays the Adhan while the tab is open.
 */
export default function usePrayerNotifications(events, active, serverPush = false) {
  const eventsRef = useRef(events);
  eventsRef.current = events;
  const serverPushRef = useRef(serverPush);
  serverPushRef.current = serverPush;

  useEffect(() => {
    if (!active) return undefined;

    function check() {
      const fired = loadFired();
      const due = dueEvents(eventsRef.current || [], Date.now(), fired);
      if (!due.length) return;
      due.forEach((e) => fired.add(e.key));
      saveFired(fired); // save first, so a second tab sees it immediately
      // The server reminder is shown by the service worker only when no SIRAJ tab is on screen, so while the tab is
      // visible the page shows it itself (works even if the server is asleep). Hidden tab + server push: the server one.
      const pageShows = !serverPushRef.current || document.visibilityState === "visible";
      if (pageShows) due.forEach((e) => {
        showPrayerNotification({ title: e.title, body: e.body, tag: `siraj-${e.key}`, url: e.url });
      });
      if (due.some((e) => e.adhan)) adhanPlayer.play();
    }

    check();
    const id = setInterval(check, 10000);
    return () => clearInterval(id);
  }, [active]);
}
