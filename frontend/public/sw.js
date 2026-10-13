/* SIRAJ service worker (offline support + prayer reminders pushed from the server).
   - App files (JS/CSS/images): cached after first visit, served fast next time.
   - Pages: network first; if offline, shows the last cached page or /offline.html.
   - API calls (/api/...) and anything on another origin are NEVER cached here,
     so private data (bookmarks, notes, tokens) is not stored by the service worker.
   - Phase 31: a "push" message from the server (prayer / Jamaat reminder) shows a notification even when
     SIRAJ is closed or minimized.
   Change VERSION when you want old caches to be removed. */
const VERSION = "siraj-v40";
const CORE = ["/offline.html", "/manifest.webmanifest", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return; // other sites and API: untouched
  if (url.pathname.startsWith("/api/")) return;
  // Phase 36: the hero video is streamed by the browser (range requests) and is never stored by the service worker
  if (req.headers.has("range") || url.pathname.startsWith("/media/video/")) return;

  // Page navigations: network first, fall back to cache, then the offline page
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put("/", copy)); return res; })
        .catch(async () => (await caches.match("/")) || (await caches.match("/offline.html")))
    );
    return;
  }

  // Static files: cache first, update in the background
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => { if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); } return res; })
        .catch(() => cached);
      return cached || network;
    })
  );
});

// Tapping a prayer reminder: focus an open SIRAJ tab or open the Prayer page.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/prayer";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          if ("navigate" in client && !client.url.endsWith(target)) client.navigate(target).catch(() => {});
          return client.focus();
        }
      }
      return self.clients.openWindow ? self.clients.openWindow(target) : undefined;
    })
  );
});

// Phase 31 - a reminder pushed by the server. Works when no SIRAJ tab is open.
// The payload is small JSON: { title, body, tag, url }. A broken payload still shows a safe default notification
// (browsers require every push to show something).
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { body: event.data ? event.data.text() : "" }; }
  const title = data.title || "SIRAJ";
  const options = {
    body: data.body || "It is time to pray.",
    tag: data.tag || "siraj-prayer",
    renotify: true,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    vibrate: [200, 100, 200],
    data: { url: typeof data.url === "string" && data.url.startsWith("/") ? data.url : "/prayer" },
  };
  // Phase 38: when a SIRAJ tab is on screen, the page already shows (and plays the Adhan for) this reminder itself,
  // so the worker does not show a second one. Otherwise (tab hidden / closed) it shows it here.
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      if (list.some((c) => c.visibilityState === "visible")) return undefined;
      return self.registration.showNotification(title, options);
    })
  );
});

// The browser replaced the push address (rare). Tell open SIRAJ tabs so they can register the new one.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      list.forEach((client) => client.postMessage({ type: "siraj-push-changed" }));
    })
  );
});
