import React from "react";
import { useI18n } from "../context/I18nContext";

export function SkeletonLine({ className = "" }) {
  return <div className={`animate-pulse bg-noor-surface2 rounded-md ${className}`} />;
}

export function SkeletonCard() {
  return (
    <div className="glass-card p-6 space-y-3">
      <SkeletonLine className="h-4 w-1/3" />
      <SkeletonLine className="h-6 w-2/3" />
      <SkeletonLine className="h-4 w-full" />
      <SkeletonLine className="h-4 w-5/6" />
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  const { t } = useI18n();
  return (
    <div className="glass-card p-8 text-center space-y-4">
      <p className="text-noor-textMuted">{message || t("common.loadError")}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-5 py-2 rounded-full bg-noor-gold text-noor-onAccent font-medium hover:bg-noor-goldBright transition-colors"
        >
          {t("common.retry")}
        </button>
      )}
    </div>
  );
}
