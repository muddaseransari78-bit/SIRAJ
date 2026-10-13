import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchHadithBooks } from "../../services/contentService";
import { SkeletonCard, ErrorState } from "../../components/Skeleton";
import GlassCard from "../../components/GlassCard";
import { useI18n } from "../../context/I18nContext";

export default function HadithBooks() {
  const { t, lang, isRTL } = useI18n();
  const { collection } = useParams();
  const [books, setBooks] = useState(null);
  const [error, setError] = useState(false);

  const load = () => {
    setError(false);
    setBooks(null);
    fetchHadithBooks(collection).then(setBooks).catch(() => setError(true));
  };
  useEffect(load, [collection]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <Link to="/hadith" className="text-sm text-noor-textMuted hover:text-noor-goldBright">{isRTL ? "→" : "←"} {t("hadith.allCollections")}</Link>
      <h1 className="text-3xl font-display text-noor-goldBright my-3 capitalize">{t(`hadith.col.${collection}`) !== `hadith.col.${collection}` && lang !== "en" ? t(`hadith.col.${collection}`) : collection}</h1>
      {error && <ErrorState message={t("hadith.booksError")} onRetry={load} />}
      {!books && !error && <div className="space-y-3">{[1,2,3].map((i) => <SkeletonCard key={i} />)}</div>}
      {books && (
        <div className="space-y-3">
          {books.map((b) => (
            <Link key={b.bookNumber} to={`/hadith/${collection}/${b.bookNumber}`}>
              <GlassCard className="flex items-center justify-between hover:shadow-emeraldGlow transition-shadow">
                <div>
                  <p className="text-xs text-noor-textMuted">{t("hadith.book", { n: b.bookNumber })}</p>
                  <p className="font-medium">{lang === "ar" ? (b.name?.ar || b.name?.en) : b.name?.en}</p>
                </div>
                <div className="text-end">
                  <p className="font-arabic text-noor-goldBright">{b.name?.ar}</p>
                  <p className="text-xs text-noor-textMuted">{t("hadith.count", { n: b.hadithCount ?? "—" })}</p>
                </div>
              </GlassCard>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
