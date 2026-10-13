import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { translations, LANGUAGES } from "../i18n/translations";

const I18nContext = createContext(null);
const STORAGE_KEY = "siraj_lang";

function initialLang() {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved && translations[saved] ? saved : "en";
}

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(initialLang);
  const meta = LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0];
  const locale = lang === "ur" ? "ur-PK" : lang === "ar" ? "ar" : "en-GB";

  // Tell the browser the page language + direction (drives RTL layout and fonts)
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = meta.dir;
    localStorage.setItem(STORAGE_KEY, lang);
  }, [lang, meta.dir]);

  const setLang = useCallback((code) => {
    if (translations[code]) setLangState(code);
  }, []);

  // t("key", { n: 5 })  ->  looks up the key, falls back to English, then to the key itself
  const t = useCallback(
    (key, params) => {
      const text = translations[lang]?.[key] ?? translations.en[key] ?? key;
      if (!params) return text;
      return text.replace(/\{(\w+)\}/g, (match, name) => (params[name] !== undefined ? params[name] : match));
    },
    [lang]
  );

  const value = useMemo(() => ({ lang, setLang, t, locale, dir: meta.dir, isRTL: meta.dir === "rtl" }), [lang, setLang, t, locale, meta.dir]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within an I18nProvider");
  return ctx;
}
