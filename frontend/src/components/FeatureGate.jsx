import React from "react";
import { Link } from "react-router-dom";
import usePublicSettings from "../hooks/usePublicSettings";
import { useI18n } from "../context/I18nContext";

// Shows the page only while the admin has the feature switched on.
// feature = a key of the public settings, e.g. "ramadanEnabled".
export default function FeatureGate({ feature, name, nameKey, children }) {
  const { t } = useI18n();
  const label = nameKey ? t(nameKey) : name;
  const { settings, ready } = usePublicSettings();
  if (!ready) return <p role="status" className="text-center py-24 text-noor-textMuted">{t("common.loading")}</p>;
  if (settings[feature]) return children;
  return (
    <div className="max-w-md mx-auto px-4 py-24 text-center space-y-4">
      <h1 className="text-2xl font-display text-noor-goldBright">{t("gate.off", { name: label })}</h1>
      <p className="text-noor-textMuted text-sm">{t("gate.offText")}</p>
      <Link to="/" className="inline-block px-5 py-2 rounded-full bg-noor-gold text-noor-onAccent font-medium">{t("common.backHome")}</Link>
    </div>
  );
}
