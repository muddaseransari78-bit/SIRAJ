import React from "react";
import { useI18n } from "../context/I18nContext";

/**
 * Switch between "Ayah cards" and "Mushaf-style text" (Phase 30: used in every Quran view).
 * Props: settings, onChange(patch)
 */
export default function ViewModeToggle({ settings, onChange }) {
  const { t } = useI18n();
  const cls = (on) => `px-3 py-1 rounded-full text-sm border ${on ? "bg-noor-gold text-noor-onAccent border-noor-gold" : "bg-noor-surface2 border-noor-border"}`;
  return (
    <div className="flex gap-2" role="group" aria-label={t("reader.viewMode")}>
      <button type="button" aria-pressed={!settings.mushafView} onClick={() => onChange({ mushafView: false })} className={cls(!settings.mushafView)}>
        {t("reader.cardView")}
      </button>
      <button type="button" aria-pressed={!!settings.mushafView} onClick={() => onChange({ mushafView: true })} className={cls(!!settings.mushafView)}>
        {t("reader.mushafView")}
      </button>
    </div>
  );
}
