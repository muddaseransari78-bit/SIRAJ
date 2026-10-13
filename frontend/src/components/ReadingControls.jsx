import React from "react";
import { ARABIC_FONTS } from "../hooks/useReadingSettings";
import { useI18n } from "../context/I18nContext";
import { TAJWEED_RULES } from "../utils/tajweed";

function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`px-3 py-1 rounded-full text-sm border ${
        active ? "bg-noor-gold text-noor-onAccent border-noor-gold" : "bg-noor-surface2 border-noor-border"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Reading settings panel.
 * Props: settings, onChange(patch), hasUrdu, hasTransliteration
 */
export default function ReadingControls({ settings, onChange, hasUrdu = true, hasTransliteration = true }) {
  const { t } = useI18n();
  return (
    <div className="glass-card px-4 py-4 mb-8 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-noor-textMuted w-24">{t("reader.textSize")}</span>
        <button onClick={() => onChange({ fontSize: Math.max(18, settings.fontSize - 2) })} aria-label={t("reader.decrease")} className="px-3 py-1 rounded-full bg-noor-surface2 text-sm">A-</button>
        <span className="text-sm w-8 text-center">{settings.fontSize}</span>
        <button onClick={() => onChange({ fontSize: Math.min(56, settings.fontSize + 2) })} aria-label={t("reader.increase")} className="px-3 py-1 rounded-full bg-noor-surface2 text-sm">A+</button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-noor-textMuted w-24">{t("reader.arabicFont")}</span>
        {ARABIC_FONTS.map((f) => (
          <Chip key={f.id} active={settings.arabicFont === f.id} onClick={() => onChange({ arabicFont: f.id })}>{f.label}</Chip>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-noor-textMuted w-24">{t("reader.show")}</span>
        <Chip active={settings.showEnglish} onClick={() => onChange({ showEnglish: !settings.showEnglish })}>{t("reader.english")}</Chip>
        <Chip active={settings.showUrdu} onClick={() => onChange({ showUrdu: !settings.showUrdu })}>{t("reader.urdu")}</Chip>
        <Chip active={settings.showTransliteration} onClick={() => onChange({ showTransliteration: !settings.showTransliteration })}>{t("reader.transliteration")}</Chip>
        <Chip active={settings.showTajweed} onClick={() => onChange({ showTajweed: !settings.showTajweed })}>{t("reader.tajweed")}</Chip>
      </div>
      {settings.showTajweed && (
        <details className="text-xs text-noor-textMuted">
          <summary className="cursor-pointer">{t("reader.tajweedLegend")}</summary>
          <p className="mt-2">{t("reader.tajweedNote")}</p>
          <ul className="mt-2 grid sm:grid-cols-2 gap-x-4 gap-y-1" dir="ltr" lang="en">
            {TAJWEED_RULES.map((r) => (
              <li key={r.code} className="flex items-center gap-2"><span className={`font-arabic text-lg ${r.cls}`} aria-hidden="true">●</span>{r.name}</li>
            ))}
          </ul>
        </details>
      )}
      {!hasUrdu && settings.showUrdu && <p className="text-xs text-amber-400">{t("reader.urduMissing")}</p>}
      {!hasTransliteration && settings.showTransliteration && <p className="text-xs text-amber-400">{t("reader.translitMissing")}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-noor-textMuted w-24">{t("reader.mode")}</span>
        <Chip active={settings.theme === "dark"} onClick={() => onChange({ theme: "dark" })}>{t("reader.dark")}</Chip>
        <Chip active={settings.theme === "soft"} onClick={() => onChange({ theme: "soft" })}>{t("reader.soft")}</Chip>
      </div>
    </div>
  );
}
