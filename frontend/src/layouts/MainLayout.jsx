import React, { Suspense, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import SiteNotice from "../components/SiteNotice";
import RouteAnnouncer from "../components/RouteAnnouncer";
import ScrollToTop from "../components/ScrollToTop";
import SiteBackground from "../components/SiteBackground";
import ErrorBoundary from "../components/ErrorBoundary";
import CrashScreen from "../components/CrashScreen";
import useScrollReveal from "../hooks/useScrollReveal";
import { SkeletonCard } from "../components/Skeleton";
import { useI18n } from "../context/I18nContext";
import { resolveMeta, applyMeta } from "../utils/seo";

// Phase 33: every public and user page now follows the language switcher.
// Only /admin (a separate route in App.jsx) stays English. Put a path in this list to show the
// "not translated yet" notice again for a page you add later and have not translated.
const NOT_TRANSLATED = [];
function isTranslated(pathname) {
  return !NOT_TRANSLATED.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

// Title, description, canonical, Open Graph and robots tags for every address live in utils/seo.js.
function usePageMeta(pathname) {
  useEffect(() => {
    applyMeta(document, resolveMeta(pathname), window.location.origin);
  }, [pathname]);
}

export default function MainLayout() {
  const { lang, t } = useI18n();
  const { pathname } = useLocation();
  const translated = lang === "en" || isTranslated(pathname);
  usePageMeta(pathname);
  useScrollReveal("main");
  const section = pathname.split("/")[1] || "home";

  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col">
      {/* picture of the active theme behind everything; if it ever fails the plain theme colour stays */}
      <ErrorBoundary fallback={null}><SiteBackground /></ErrorBoundary>
      <a href="#main-content" className="skip-link">{t("a11y.skip")}</a>
      <RouteAnnouncer />
      <ScrollToTop />
      <SiteNotice />
      <Navbar />
      <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
        {!translated && (
          <div className="max-w-3xl mx-auto px-4 pt-4">
            <p role="status" className="text-xs text-noor-textMuted bg-noor-surface2 border border-noor-border rounded-lg px-3 py-2">
              {t("layout.notTranslated")}
            </p>
          </div>
        )}
        {/* Untranslated pages stay English + left-to-right so they never look broken */}
        <div {...(translated ? {} : { dir: "ltr", lang: "en", className: "en-reset" })}>
          {/* Soft fade + tiny rise when you move to another SECTION (key = first part of the address, so
              /quran/1 -> /quran/2 does not restart the page or the audio). Follows reduced motion / Lite mode. */}
          <motion.div key={section} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: "easeOut" }}>
            <CrashScreen resetKey={pathname}>
              <Suspense fallback={<div className="max-w-3xl mx-auto px-4 py-12" role="status" aria-label="Loading"><SkeletonCard /></div>}>
                <Outlet />
              </Suspense>
            </CrashScreen>
          </motion.div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
