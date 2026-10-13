import React from "react";
import { Globe } from "lucide-react";
import { useI18n } from "../context/I18nContext";
import { LANGUAGES } from "../i18n/translations";

// Small dropdown: English / اردو / العربية
export default function LanguageSwitcher({ className = "" }) {
  const { lang, setLang, t } = useI18n();
  return (
    <label className={`flex items-center gap-1 ${className}`}>
      <Globe size={16} className="text-noor-textMuted" aria-hidden="true" />
      <span className="sr-only">{t("nav.language")}</span>
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value)}
        className="bg-noor-surface2 border border-noor-border rounded-full px-2 py-1 text-xs text-noor-text"
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>{l.label}</option>
        ))}
      </select>
    </label>
  );
}
