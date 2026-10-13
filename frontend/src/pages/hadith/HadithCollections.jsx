import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fetchCollections } from "../../services/contentService";
import { SkeletonCard, ErrorState } from "../../components/Skeleton";
import GlassCard from "../../components/GlassCard";
import { useI18n } from "../../context/I18nContext";

export default function HadithCollections() {
  const { t, lang } = useI18n();
  const [items, setItems] = useState(null);
  const [error, setError] = useState(false);
  const [q, setQ] = useState("");
  const navigate = useNavigate();

  const load = () => {
    setError(false);
    setItems(null);
    fetchCollections().then(setItems).catch(() => setError(true));
  };
  useEffect(load, []);

  const onSearch = (e) => {
    e.preventDefault();
    if (q.trim().length >= 2) navigate(`/hadith/search?q=${encodeURIComponent(q.trim())}`);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-display text-noor-goldBright mb-2">{t("hadith.title")}</h1>
      <p className="text-noor-textMuted mb-6">{t("hadith.subtitle")}</p>

      <form onSubmit={onSearch} className="flex gap-2 mb-8">
        <input type="search" inputMode="search" enterKeyHint="search" dir="auto" maxLength={100} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("hadith.searchPlaceholder")}
          aria-label={t("hadith.searchBtn")} className="flex-1 rounded-lg bg-noor-surface2 border border-noor-border px-4 py-3" />
        <button className="px-5 rounded-lg bg-noor-gold text-noor-onAccent font-medium">{t("hadith.searchBtn")}</button>
      </form>

      {error && <ErrorState message={t("hadith.loadError")} onRetry={load} />}
      {!items && !error && <div className="grid sm:grid-cols-2 gap-4">{[1,2,3,4].map((i) => <SkeletonCard key={i} />)}</div>}
      {items && (
        <div className="grid sm:grid-cols-2 gap-4">
          {items.map((c) => (
            <Link key={c.slug} to={`/hadith/${c.slug}`}>
              <GlassCard className="hover:shadow-emeraldGlow transition-shadow h-full">
                <p className="font-medium text-lg">{lang === "ar" ? (c.name?.ar || c.name?.en || c.slug) : (c.name?.en || c.slug)}</p>
                <p className="font-arabic text-noor-goldBright text-xl">{c.name?.ar}</p>
                <p className="text-xs text-noor-textMuted mt-2">{t("hadith.count", { n: c.totalHadith ?? "—" })}</p>
              </GlassCard>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
