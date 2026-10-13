import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import GlassCard from "../../components/GlassCard";
import { ErrorState, SkeletonCard } from "../../components/Skeleton";
import { fetchTopics, fetchTopic } from "../../services/quranService";
import AyahSnippet from "../../components/AyahSnippet";
import { resultSurahName } from "../../utils/ayahLayers";
import { useI18n } from "../../context/I18nContext";

export default function Topics() {
  const { t, lang } = useI18n();
  const topicLabel = (tp) => { const key = `topic.${tp.slug}`; const v = t(key); return v !== key ? v : tp.label; };
  const [params, setParams] = useSearchParams();
  const slug = params.get("t") || "";
  const [topics, setTopics] = useState(null);
  const [topicsError, setTopicsError] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  const loadTopics = () => { setTopicsError(false); fetchTopics().then(setTopics).catch(() => setTopicsError(true)); };
  useEffect(loadTopics, []);

  const loadTopic = () => {
    if (!slug) return;
    setError(false); setData(null);
    fetchTopic(slug, lang).then(setData).catch(() => setError(true));
  };
  useEffect(loadTopic, [slug, lang]); // the Ayahs are shown in the chosen language, so reload when it changes

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-display text-noor-goldBright mb-2">{t("topics.title")}</h1>
      <p className="text-noor-textMuted mb-4">{t("topics.subtitle")}</p>
      <p role="note" className="text-xs text-noor-textMuted glass-card p-3 mb-6">
        {t("topics.note")}
      </p>

      {topicsError && <ErrorState message={t("topics.loadError")} onRetry={loadTopics} />}
      {!topics && !topicsError && <SkeletonCard />}
      {topics && (
        <div className="flex flex-wrap gap-2 mb-8" role="group" aria-label={t("topics.group")}>
          {topics.map((tp) => (
            <button key={tp.slug} aria-pressed={slug === tp.slug} onClick={() => setParams({ t: tp.slug })}
              className={`px-4 py-2 rounded-full text-sm border ${slug === tp.slug ? "bg-noor-gold text-noor-onAccent border-noor-gold" : "bg-noor-surface2 border-noor-border"}`}>
              {topicLabel(tp)}
            </button>
          ))}
        </div>
      )}

      {slug && error && <ErrorState message={t("topics.topicError")} onRetry={loadTopic} />}
      {slug && !data && !error && <SkeletonCard />}
      {data && (
        <section aria-live="polite">
          <h2 className="text-xl mb-1">{topicLabel(data.topic)}</h2>
          <p className="text-xs text-noor-textMuted mb-4">
            {lang === "en"
              ? (data.total > data.results.length ? t("topics.metaOf", { words: data.topic.keywords.join(", "), n: data.results.length, total: data.total }) : t("topics.meta", { words: data.topic.keywords.join(", "), n: data.results.length }))
              : (data.total > data.results.length ? t("topics.metaOfNoWords", { n: data.results.length, total: data.total }) : t("topics.metaNoWords", { n: data.results.length }))}
          </p>
          <div className="space-y-2">
            {data.results.map((r) => (
              <Link key={`${r.surahNumber}:${r.ayahNumber}`} to={`/quran/${r.surahNumber}?ayah=${r.ayahNumber}`} className="block glass-card p-4 hover:shadow-emeraldGlow">
                <p className="text-xs text-noor-goldBright">{resultSurahName(r, lang)} {r.surahNumber}:{r.ayahNumber}</p>
                <AyahSnippet r={r} lang={lang} />
              </Link>
            ))}
            {data.results.length === 0 && <GlassCard><p className="text-noor-textMuted text-sm">{t("topics.none")}</p></GlassCard>}
          </div>
        </section>
      )}
    </div>
  );
}
