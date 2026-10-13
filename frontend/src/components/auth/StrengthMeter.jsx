import React from "react";
import { useI18n } from "../../context/I18nContext";
import { passwordStrength } from "../../utils/passwordStrength";

const COLORS = ["", "rgb(var(--noor-danger))", "rgb(var(--noor-warn))", "rgb(var(--noor-emeraldBright))", "rgb(var(--noor-success))"];

// Four little bars under the password box. Only a hint; the real rules are checked by the server.
export default function StrengthMeter({ password }) {
  const { t } = useI18n();
  const level = passwordStrength(password);
  if (!level) return null;
  return (
    <div className="mt-2" role="status" aria-live="polite">
      <div className="flex gap-1.5" aria-hidden="true">
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className="strength-seg" style={i <= level ? { backgroundColor: COLORS[level] } : undefined} />
        ))}
      </div>
      <p className="text-xs mt-1 text-noor-textMuted">
        {t("auth.strength.label")}: <span style={{ color: COLORS[level] }}>{t(`auth.strength.${level}`)}</span>
      </p>
    </div>
  );
}
