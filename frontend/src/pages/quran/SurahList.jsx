import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { surahPath } from "../../utils/surahSlugs";
import { fetchSurahs } from "../../services/quranService";
import { SkeletonCard, ErrorState } from "../../components/Skeleton";
import GlassCard from "../../components/GlassCard";
import { useI18n } from "../../context/I18nContext";
import { filterSurahs, parseAyahRef } from "../../utils/surahFilter";

const BROWSE = [
  { id: "surah" },
  { id: "juz", max: 30 },
  { id: "page", max: 604 },
  { id: "hizb", max: 240 },
  { id: "ruku", max: 556 },
];

export default function SurahList() {
  const navigate = useNavigate();
  const { t, isRTL } = useI18n();
  const [tab, setTab] = useState("surah");
  const [jumpNumber, setJumpNumber] = useState("");
  const [surahs, setSurahs] = useState(null);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  // "Open with ..." options: every link below (Surah, Juz, Page, Hizb, Ruku) carries them to the reader
  const [withAudio, setWithAudio] = useState(false);
  const [withMushaf, setWithMushaf] = useState(false);

  function load() {
    setError(false);
    setSurahs(null);
    fetchSurahs()
      .then(setSurahs)
      .catch(() => setError(true));
  }

  useEffect(() => {
    load();
  }, []);

  const activeBrowse = BROWSE.find((b) => b.id === tab);
  const params = [withAudio ? "play=1" : "", withMushaf ? "view=mushaf" : ""].filter(Boolean).join("&");
  const suffix = params ? `?${params}` : "";

  function goToNumber(e) {
    e.preventDefault();
    const n = Number(jumpNumber);
    if (Number.isInteger(n) && n >= 1 && n <= activeBrowse.max) navigate(`/quran/${tab}/${n}${suffix}`);
  }

  // Finds a Surah by English / Arabic / Urdu name, by number, or by its meaning (Phase 39)
  const filtered = useMemo(() => filterSurahs(surahs, query), [surahs, query]);
  const trimmed = query.trim();

  // Enter: "2:255" opens that Ayah, one match opens that Surah, no match searches the Quran text
  function submitSearch(e) {
    e.preventDefault();
    const ref = parseAyahRef(trimmed);
    if (ref) return navigate(surahPath(ref.surah, `?ayah=${ref.ayah}`));
    if (filtered.length === 1 && trimmed) return navigate(surahPath(filtered[0].number, suffix));
    if (trimmed.length >= 2) navigate(`/search?q=${encodeURIComponent(trimmed)}&type=quran`);
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-display text-noor-goldBright mb-2">{t("quran.title")}</h1>
      <p className="text-noor-textMuted mb-6">{t("quran.subtitle")}</p>

      <div className="flex flex-wrap gap-2 mb-6" role="tablist" aria-label={t("quran.browseBy")}>
        {BROWSE.map((b) => (
          <button
            key={b.id} role="tab" aria-selected={tab === b.id}
            onClick={() => { setTab(b.id); setJumpNumber(""); }}
            className={`px-4 py-1.5 rounded-full text-sm border ${tab === b.id ? "bg-noor-gold text-noor-onAccent border-noor-gold" : "bg-noor-surface2 border-noor-border"}`}
          >
            {t(`quran.tab.${b.id}`)}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-6" role="group" aria-label={t("reader.openWith")}>
        <span className="text-sm text-noor-textMuted">{t("reader.openWith")}</span>
        <button type="button" aria-pressed={withAudio} onClick={() => setWithAudio((v) => !v)}
          className={`px-3 py-1 rounded-full text-sm border ${withAudio ? "bg-noor-gold text-noor-onAccent border-noor-gold" : "bg-noor-surface2 border-noor-border"}`}>
          🎧 {t("reader.openWithAudio")}
        </button>
        <button type="button" aria-pressed={withMushaf} onClick={() => setWithMushaf((v) => !v)}
          className={`px-3 py-1 rounded-full text-sm border ${withMushaf ? "bg-noor-gold text-noor-onAccent border-noor-gold" : "bg-noor-surface2 border-noor-border"}`}>
          📖 {t("reader.openWithMushaf")}
        </button>
      </div>

      {tab !== "surah" && (
        <div className="mb-8">
          <form onSubmit={goToNumber} className="flex items-center gap-2 mb-4">
            <label htmlFor="jump-number" className="text-sm text-noor-textMuted">{t("quran.goTo", { label: t(`quran.tab.${activeBrowse.id}`), max: activeBrowse.max })}</label>
            <input
              id="jump-number" type="number" min="1" max={activeBrowse.max} value={jumpNumber}
              onChange={(e) => setJumpNumber(e.target.value)}
              className="w-28 rounded-lg bg-noor-surface2 border border-noor-border px-3 py-1.5 text-sm"
            />
            <button type="submit" className="px-3 py-1.5 rounded-lg bg-noor-gold text-noor-onAccent text-sm">{t("common.go")}</button>
          </form>
          {tab === "juz" && (
            <div className="grid grid-cols-5 sm:grid-cols-6 gap-2">
              {Array.from({ length: 30 }, (_, i) => i + 1).map((n) => (
                <Link key={n} to={`/quran/juz/${n}${suffix}`} className="glass-card text-center py-3 hover:shadow-emeraldGlow">{t("quran.juzLabel", { n })}</Link>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "surah" && (
        <form onSubmit={submitSearch} role="search" className="mb-8">
          <input
            type="search" inputMode="search" enterKeyHint="search" autoComplete="off" dir="auto"
            placeholder={t("quran.searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-lg bg-noor-surface2 border border-noor-border px-4 py-3 text-noor-text"
            aria-label={t("quran.searchAria")}
          />
          {surahs && trimmed && (
            <p className="mt-2 text-xs text-noor-textMuted" role="status" aria-live="polite">
              {filtered.length === 0 ? `${t("quran.noSurah", { q: trimmed })} ` : ""}
              {trimmed.length >= 2 && (
                <Link to={`/search?q=${encodeURIComponent(trimmed)}&type=quran`} className="text-noor-goldBright underline">{t("quran.searchVerses", { q: trimmed })} {isRTL ? "←" : "→"}</Link>
              )}
            </p>
          )}
        </form>
      )}

      {tab === "surah" && error && <ErrorState message={t("quran.listError")} onRetry={load} />}

      {tab === "surah" && !surahs && !error && (
        <div className="grid sm:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {tab === "surah" && surahs && (
        <div className="grid sm:grid-cols-2 gap-4">
          {filtered.map((surah) => (
            <Link key={surah.number} to={surahPath(surah.number, suffix)}>
              <GlassCard className="flex items-center justify-between hover:shadow-emeraldGlow transition-shadow">
                <div>
                  <p className="text-xs text-noor-textMuted mb-1">
                    {surah.number}. {t(`quran.${surah.revelationType}`)}
                  </p>
                  <p className="font-medium">{surah.englishName}</p>
                  <p className="text-sm text-noor-textMuted">{surah.englishNameTranslation}</p>
                </div>
                <div className="text-end">
                  <p className="font-arabic text-xl text-noor-goldBright">{surah.name}</p>
                  <p className="text-xs text-noor-textMuted mt-1">{t("quran.ayahsCount", { n: surah.numberOfAyahs })}</p>
                </div>
              </GlassCard>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
