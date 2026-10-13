import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useI18n } from "../context/I18nContext";
import { logoFile } from "../theme/themeMedia";
import { useTheme } from "../context/ThemeContext";

// The big SIRAJ name at the very end of the page: letters rise one by one when it scrolls into view,
// and lift again when you hover them.
const WORD = "SIRAJ".split("");

function FooterWordmark() {
  return (
    <div className="footer-mark" aria-hidden="true" data-no-reveal>
      <motion.div
        className="footer-mark-word"
        dir="ltr"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "0px 0px -5% 0px" }}
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.09 } } }}
      >
        {WORD.map((ch, i) => (
          <motion.span
            key={i}
            className="footer-letter"
            variants={{ hidden: { opacity: 0, y: 70 }, show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.2, 0.7, 0.2, 1] } } }}
            whileHover={{ y: -14, transition: { duration: 0.25 } }}
          >
            {ch}
          </motion.span>
        ))}
      </motion.div>
    </div>
  );
}

const COLUMNS = [
  {
    title: "footer.readLearn",
    links: [
      { to: "/quran", label: "nav.quran" },
      { to: "/hadith", label: "nav.hadith" },
      { to: "/tafseer", label: "nav.tafseer" },
      { to: "/duas", label: "nav.duas" },
      { to: "/topics", label: "footer.topics" },
      { to: "/assistant", label: "footer.assistant" },
    ],
  },
  {
    title: "footer.worship",
    links: [
      { to: "/prayer", label: "nav.prayer" },
      { to: "/qibla", label: "nav.qibla" },
      { to: "/tasbeeh", label: "nav.tasbeeh" },
      { to: "/calendar", label: "footer.calendar" },
      { to: "/ramadan", label: "footer.ramadan" },
      { to: "/recitation/live", label: "nav.recite" },
      { to: "/recitation", label: "footer.recitation" },
    ],
  },
  {
    title: "SIRAJ",
    links: [
      { to: "/about", label: "footer.about" },
      { to: "/privacy", label: "footer.privacy" },
      { to: "/terms", label: "footer.terms" },
      { to: "/feedback", label: "nav.feedback" },
      { to: "/contact", label: "footer.contact" },
    ],
  },
];

export default function Footer() {
  const { t, lang } = useI18n();
  const { themeId } = useTheme();
  const arabicQuote = lang !== "en"; // Urdu/Arabic show the Quranic verse itself
  return (
    <footer aria-label="SIRAJ" className="footer-pattern mt-24 border-t border-noor-border pb-20 lg:pb-0">
      <div className="max-w-7xl mx-auto px-4 py-14 grid grid-cols-2 md:grid-cols-4 gap-10">
        <div className="col-span-2 md:col-span-1">
          <div className="flex items-center gap-2 mb-3">
            <img src={logoFile(themeId, true)} width="44" height="44" alt="" loading="lazy" className="h-11 w-11 object-contain nav-logo" />
            <span className="font-display text-xl text-noor-goldBright">SIRAJ</span>
          </div>
          <p className="text-sm text-noor-textMuted leading-relaxed">
            {t("brand.tagline")}
          </p>
        </div>

        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h2 className="text-sm font-semibold text-noor-text mb-3 font-body">{col.title === "SIRAJ" ? col.title : t(col.title)}</h2>
            <ul className="space-y-2">
              {col.links.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="footer-link text-sm text-noor-textMuted hover:text-noor-goldBright">
                    {t(l.label)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="max-w-7xl mx-auto px-4 border-t border-noor-border pt-6 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="text-center md:text-start">
          <p
            lang={arabicQuote ? "ar" : undefined}
            className={`text-noor-textMuted ${arabicQuote ? "font-arabic text-xl" : "text-sm italic font-display"}`}
          >
            {t("footer.quote")}
          </p>
          <p className="text-xs text-noor-textMuted mt-1">{t("footer.quoteRef")}</p>
        </div>
        <div className="text-center md:text-end">
          <p className="text-xs text-noor-textMuted">{t("footer.madeFor")}</p>
          <p className="text-xs text-noor-textMuted mt-1">© {new Date().getFullYear()} SIRAJ</p>
        </div>
      </div>

      <FooterWordmark />
    </footer>
  );
}
