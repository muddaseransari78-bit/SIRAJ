// Loads the big optional fonts AFTER the first paint (Phase 20 - performance).
// index.html only loads the small core fonts (Inter, Amiri, Noto Naskh Arabic) so the page appears fast.
// The Urdu (Nastaliq) font is very large: it is loaded at once only when the interface is Urdu,
// otherwise when the browser is idle. Scheherazade (alternative Quran font) also loads when idle.
// Done from JavaScript (not an inline HTML handler) so a strict Content-Security-Policy still works.

const BASE = "https://fonts.googleapis.com/css2?family=";
const URDU = `${BASE}Noto+Nastaliq+Urdu:wght@400;700&display=swap`;
const SCHEHERAZADE = `${BASE}Scheherazade+New:wght@400;700&display=swap`;

function addStylesheet(href) {
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

export function loadExtraFonts() {
  if (typeof document === "undefined") return;
  const conn = navigator.connection || {};
  if (conn.saveData) {
    // Data Saver: only what the interface language really needs
    if (localStorage.getItem("siraj_lang") === "ur") addStylesheet(URDU);
    return;
  }
  if (localStorage.getItem("siraj_lang") === "ur") addStylesheet(URDU);

  const later = () => { addStylesheet(URDU); addStylesheet(SCHEHERAZADE); };
  const start = () => ("requestIdleCallback" in window ? window.requestIdleCallback(later, { timeout: 4000 }) : setTimeout(later, 2500));
  if (document.readyState === "complete") start();
  else window.addEventListener("load", start, { once: true });
}
