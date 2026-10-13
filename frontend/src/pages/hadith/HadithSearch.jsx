import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Search as SearchIcon } from "lucide-react";
import { searchHadith } from "../../services/contentService";
import { SkeletonCard, ErrorState } from "../../components/Skeleton";
import HadithCard from "./HadithCard";
import { useI18n } from "../../context/I18nContext";

export default function HadithSearch() {
  const { t, isRTL } = useI18n();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const q = (params.get("q") || "").trim();
  const [input, setInput] = useState(q);
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  const load = () => {
    setError(false);
    setData(null);
    if (q.length < 2) return;
    searchHadith(q).then(setData).catch(() => setError(true));
  };
  useEffect(load, [q]);
  useEffect(() => { setInput(q); }, [q]);

  // A new search can be typed right here (before, you had to go back to the library page)
  const submit = (e) => {
    e.preventDefault();
    const next = input.trim();
    if (next.length >= 2) navigate(`/hadith/search?q=${encodeURIComponent(next)}`);
  };

  const results = data?.hadiths || data?.results || [];

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <Link to="/hadith" className="text-sm text-noor-textMuted hover:text-noor-goldBright">{isRTL ? "→" : "←"} {t("hadith.backLibrary")}</Link>
      <h1 className="text-2xl font-display text-noor-goldBright my-3">{t("hadith.results", { q })}</h1>
      <form onSubmit={submit} role="search" className="flex gap-2 mb-6">
        <input type="search" inputMode="search" enterKeyHint="search" dir="auto" maxLength={100} value={input} onChange={(e) => setInput(e.target.value)}
          placeholder={t("hadith.searchPlaceholder")} aria-label={t("hadith.searchBtn")}
          className="flex-1 rounded-lg bg-noor-surface2 border border-noor-border px-4 py-3" />
        <button className="px-5 rounded-lg bg-noor-gold text-noor-onAccent font-medium flex items-center gap-2"><SearchIcon size={16} aria-hidden="true" /> {t("hadith.searchBtn")}</button>
      </form>
      {q.length < 2 && <p className="text-noor-textMuted">{t("search.minChars")}</p>}
      {error && <ErrorState message={t("hadith.searchFail")} onRetry={load} />}
      {q.length >= 2 && !data && !error && <div className="space-y-4">{[1,2].map((i) => <SkeletonCard key={i} />)}</div>}
      {data && (
        <div className="space-y-4">
          {results.map((h, i) => <HadithCard key={i} hadith={h} />)}
          {results.length === 0 && (
            <div className="text-noor-textMuted space-y-2">
              <p>{t("hadith.noResults")}</p>
              <p className="text-sm">{t("hadith.searchTip")} <Link to={`/search?q=${encodeURIComponent(q)}`} className="text-noor-goldBright underline">{t("hadith.searchEverywhere")}</Link></p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
