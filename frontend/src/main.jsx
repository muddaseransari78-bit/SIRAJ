import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { I18nProvider } from "./context/I18nContext.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import MotionRoot from "./components/MotionRoot.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { loadExtraFonts } from "./utils/loadFonts.js";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <I18nProvider>
        <ThemeProvider>
          <AuthProvider>
            <MotionRoot>
              {/* last safety net: if something very unexpected breaks, show a reload button instead of a blank page */}
              <ErrorBoundary fallback={<div role="alert" style={{ padding: "4rem 1rem", textAlign: "center" }}><p>SIRAJ hit a problem.</p><button type="button" onClick={() => window.location.reload()} style={{ marginTop: "1rem", padding: "0.6rem 1.4rem", borderRadius: "999px", border: "1px solid currentColor" }}>Reload</button></div>}>
                <App />
              </ErrorBoundary>
            </MotionRoot>
          </AuthProvider>
        </ThemeProvider>
      </I18nProvider>
    </BrowserRouter>
  </React.StrictMode>
);

// Heavy fonts (Urdu Nastaliq, Scheherazade) load after the page is already visible
loadExtraFonts();

// Offline support (production build only, so it never gets in the way while you develop)
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
