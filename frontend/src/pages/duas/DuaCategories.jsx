import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchDuaCategories } from "../../services/contentService";
import { SkeletonCard, ErrorState } from "../../components/Skeleton";
import GlassCard from "../../components/GlassCard";
import { useI18n } from "../../context/I18nContext";

export default function DuaCategories() {
  const { t } = useI18n();
  const label = (s) => { const k = `duas.cat.${s}`; const v = t(k); return v !== k ? v : s; };
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const load = () => { setError(false); setData(null); fetchDuaCategories().then(setData).catch(() => setError(true)); };
  useEffect(load, []);

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-display text-noor-goldBright mb-2">{t("duas.title")}</h1>
      <p className="text-noor-textMuted mb-8">{t("duas.subtitle")}</p>
      {error && <ErrorState message={t("duas.loadError")} onRetry={load} />}
      {!data && !error && <div className="grid sm:grid-cols-3 gap-4">{[1,2,3].map((i) => <SkeletonCard key={i} />)}</div>}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {data.shortcuts.map((s) => (
            <Link key={s} to={`/duas/${s}`}>
              <GlassCard className="text-center py-8 hover:shadow-emeraldGlow transition-shadow">
                <span className="text-2xl block mb-2">🤲</span>
                <span>{label(s)}</span>
              </GlassCard>
            </Link>
          ))}
          {(data.customCategories || []).map((s) => (
            <Link key={s} to={`/duas/${s}`}>
              <GlassCard className="text-center py-8 hover:shadow-emeraldGlow transition-shadow">
                <span className="text-2xl block mb-2">🤲</span>
                <span className="capitalize">{s.replace(/-/g, " ")}</span>
              </GlassCard>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
