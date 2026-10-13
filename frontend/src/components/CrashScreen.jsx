import React from "react";
import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import ErrorBoundary from "./ErrorBoundary";
import { useI18n } from "../context/I18nContext";

function Message({ onRetry }) {
  const { t } = useI18n();
  return (
    <div role="alert" className="max-w-md mx-auto px-4 py-20">
      <div className="glass-card p-8 text-center">
        <AlertTriangle size={36} className="mx-auto text-noor-warn" aria-hidden="true" />
        <h2 className="text-2xl mt-3 mb-2">{t("error.title")}</h2>
        <p className="text-sm text-noor-textMuted mb-6">{t("error.body")}</p>
        <div className="flex gap-3 justify-center">
          <button type="button" onClick={onRetry} className="px-5 py-2.5 rounded-full bg-noor-gold text-noor-onAccent font-medium">{t("error.retry")}</button>
          <button type="button" onClick={() => window.location.reload()} className="px-5 py-2.5 rounded-full border border-noor-border">{t("error.reload")}</button>
        </div>
        <Link to="/" className="inline-block mt-5 text-sm text-noor-goldBright">SIRAJ</Link>
      </div>
    </div>
  );
}

// If one page crashes, the navbar and the rest of SIRAJ stay alive and the person sees a friendly message
// with a retry button instead of a blank screen. Opening another page (resetKey = the address) clears it.
export default function CrashScreen({ resetKey, children }) {
  return (
    <ErrorBoundary resetKey={resetKey} fallback={(reset) => <Message onRetry={reset} />}>
      {children}
    </ErrorBoundary>
  );
}
