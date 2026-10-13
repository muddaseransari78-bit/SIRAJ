import React from "react";
import { useLocation } from "react-router-dom";
import GlassCard from "../../components/GlassCard";
import { useI18n } from "../../context/I18nContext";

const P = ({ children }) => <p className="text-noor-textMuted leading-relaxed mb-3">{children}</p>;
const H = ({ children }) => <h2 className="text-xl text-noor-text mt-6 mb-2">{children}</h2>;

// Each page is a list of [kind, translation key]; kind "p" = paragraph, "h" = heading. Text lives in i18n/translations.js.
const PAGES = {
  "/about": ["info.about.title", [["p", "info.about.p1"], ["h", "info.about.h1"], ["p", "info.about.p2"], ["h", "info.about.h2"], ["p", "info.about.p3"], ["h", "info.about.h3"], ["p", "info.about.p4"]]],
  "/privacy": ["info.privacy.title", [["p", "info.privacy.p0"], ["h", "info.privacy.h1"], ["p", "info.privacy.p1"], ["h", "info.privacy.h2"], ["p", "info.privacy.p2"], ["h", "info.privacy.h3"], ["p", "info.privacy.p3"], ["h", "info.privacy.h4"], ["p", "info.privacy.p4"], ["h", "info.privacy.h5"], ["p", "info.privacy.p5"], ["h", "info.privacy.h6"], ["p", "info.privacy.p6"]]],
  "/terms": ["info.terms.title", [["p", "info.terms.p0"], ["h", "info.terms.h1"], ["p", "info.terms.p1"], ["h", "info.terms.h2"], ["p", "info.terms.p2"], ["h", "info.terms.h3"], ["p", "info.terms.p3"], ["h", "info.terms.h4"], ["p", "info.terms.p4"]]],
  "/contact": ["info.contact.title", [["p", "info.contact.p1"], ["p", "info.contact.p2"]]],
};

export default function InfoPages() {
  const { pathname } = useLocation();
  const { t } = useI18n();
  const [titleKey, blocks] = PAGES[pathname] || PAGES["/about"];
  return (
    <div className="max-w-2xl mx-auto px-4 py-16">
      <GlassCard>
        <h1 className="text-3xl font-display text-noor-goldBright mb-4">{t(titleKey)}</h1>
        {blocks.map(([kind, key]) => (kind === "h" ? <H key={key}>{t(key)}</H> : <P key={key}>{t(key)}</P>))}
      </GlassCard>
    </div>
  );
}
