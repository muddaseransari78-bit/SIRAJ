import React, { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { fetchSurahs } from "../../services/quranService";
import { fetchTafsirSources, fetchTafsir } from "../../services/contentService";
import { SkeletonCard, ErrorState } from "../../components/Skeleton";
import GlassCard from "../../components/GlassCard";
import { useI18n } from "../../context/I18nContext";

const strip = (t) => (t || "").replace(/<sup[^>]*>.*?<\/sup>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

export default function Tafseer() {
  const { t, lang, isRTL } = useI18n();
  const params = useParams();
  const navigate = useNavigate();
  const [surahs, setSurahs] = useState([]);
  const [sources, setSources] = useState([]);
  const [surah, setSurah] = useState(Number(params.surah) || 1);
  const [ayah, setAyah] = useState(Number(params.ayah) || 1);
  const [source, setSource] = useState("ar-tafsir-ibn-kathir");
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSurahs().then(setSurahs).catch(() => {});
    fetchTafsirSources().then((s) => { setSources(s); if (s.length && !s.find((x) => x.slug === "ar-tafsir-ibn-kathir")) setSource(s[0].slug); }).catch(() => {});
  }, []);

  const current = surahs.find((s) => s.number === surah);
  const max = current?.numberOfAyahs || 286;

  function load() {
    setLoading(true); setError(false); setData(null);
    fetchTafsir(surah, ayah, source).then(setData).catch(() => setError(true)).finally(() => setLoading(false));
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [surah, ayah, source]);
  useEffect(() => { navigate(`/tafseer/${surah}/${ayah}`, { replace: true }); /* eslint-disable-next-line */ }, [surah, ayah]);

  const tafsir = data?.tafsirs?.[0];

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-display text-noor-goldBright mb-2">{t("tafseer.title")}</h1>
      <p className="text-noor-textMuted mb-6">{t("tafseer.subtitle")}</p>

      <div className="grid sm:grid-cols-3 gap-3 mb-6">
        <select value={surah} onChange={(e) => { setSurah(Number(e.target.value)); setAyah(1); }} className="rounded-lg bg-noor-surface2 border border-noor-border px-3 py-2">
          {surahs.length === 0 && <option>{surah}</option>}
          {surahs.map((s) => <option key={s.number} value={s.number}>{s.number}. {lang === "en" ? s.englishName : s.name}</option>)}
        </select>
        <input type="number" min={1} max={max} value={ayah} onChange={(e) => setAyah(Math.min(max, Math.max(1, Number(e.target.value) || 1)))}
          className="rounded-lg bg-noor-surface2 border border-noor-border px-3 py-2" aria-label={t("tafseer.ayahNumber")} />
        <select value={source} onChange={(e) => setSource(e.target.value)} className="rounded-lg bg-noor-surface2 border border-noor-border px-3 py-2">
          {sources.length === 0 && <option value={source}>Tafsir Ibn Kathir</option>}
          {sources.map((s) => <option key={s.slug} value={s.slug}>{s.name}{s.language ? ` (${s.language})` : ""}</option>)}
        </select>
      </div>

      <div className="flex justify-between mb-4 text-sm">
        <button disabled={ayah <= 1} onClick={() => setAyah(ayah - 1)} className="px-3 py-1 rounded-full bg-noor-surface2 disabled:opacity-40">{isRTL ? "→" : "←"} {t("tafseer.prev")}</button>
        <Link to={`/quran/${surah}`} className="text-noor-goldBright">{t("tafseer.openSurah")}</Link>
        <button disabled={ayah >= max} onClick={() => setAyah(ayah + 1)} className="px-3 py-1 rounded-full bg-noor-surface2 disabled:opacity-40">{t("tafseer.next")} {isRTL ? "←" : "→"}</button>
      </div>

      {error && <ErrorState message={t("tafseer.loadError")} onRetry={load} />}
      {loading && <SkeletonCard />}
      {data && (
        <div className="space-y-4">
          <GlassCard>
            <p className="text-xs text-noor-textMuted mb-2">{t("tafseer.quranRef", { ref: data.verseKey })}</p>
            <p dir="rtl" className="font-arabic text-2xl text-right leading-loose">{data.arabic}</p>
            {data.translation && <p className="text-noor-textMuted mt-3" dir="ltr" lang="en">{strip(data.translation.text)}</p>}
            {data.translation && <p className="text-xs text-noor-textMuted mt-1">{t("tafseer.translation", { source: data.translation.source })}</p>}
          </GlassCard>
          <GlassCard>
            <p className="text-xs uppercase tracking-wide text-noor-goldBright mb-2">{t("tafseer.from", { source: tafsir?.source || source })}</p>
            {tafsir?.text
              ? <div dir={tafsir.language === "arabic" || tafsir.language === "Arabic" || /[\u0600-\u06FF]/.test(tafsir.text.slice(0, 40)) ? "rtl" : "ltr"} className="leading-loose whitespace-pre-line">{strip(tafsir.text)}</div>
              : <p className="text-noor-textMuted">{t("tafseer.none")}</p>}
            <p className="text-xs text-noor-textMuted mt-4 border-t border-noor-border pt-3">
              {t("tafseer.sourceNote", { source: tafsir?.source || source })}
            </p>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
