import React from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../context/I18nContext";

export default function NotFound() {
  const { t } = useI18n();
  return (
    <div className="max-w-xl mx-auto px-4 py-32 text-center">
      <p className="text-6xl mb-4">🕯️</p>
      <h1 className="text-2xl font-display text-noor-goldBright mb-2">{t("notfound.title")}</h1>
      <p className="text-noor-textMuted mb-6">{t("notfound.text")}</p>
      <Link to="/" className="px-5 py-2 rounded-full bg-noor-gold text-noor-onAccent font-medium">
        {t("common.backHome")}
      </Link>
    </div>
  );
}
