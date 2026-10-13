import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchHadiths } from "../../services/contentService";
import { SkeletonCard, ErrorState } from "../../components/Skeleton";
import HadithCard from "./HadithCard";
import { useI18n } from "../../context/I18nContext";

const PAGE = 20;

export default function HadithList() {
  const { t, lang, isRTL } = useI18n();
  const { collection, bookNumber } = useParams();
  const [data, setData] = useState(null);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState(false);

  const load = () => {
    setError(false);
    setData(null);
    fetchHadiths(collection, bookNumber, offset, PAGE).then(setData).catch(() => setError(true));
  };
  useEffect(load, [collection, bookNumber, offset]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <Link to={`/hadith/${collection}`} className="text-sm text-noor-textMuted hover:text-noor-goldBright">{isRTL ? "→" : "←"} {t("hadith.books")}</Link>
      <h1 className="text-2xl font-display text-noor-goldBright my-3 capitalize">{t(`hadith.col.${collection}`) !== `hadith.col.${collection}` && lang !== "en" ? t(`hadith.col.${collection}`) : collection} — {t("hadith.book", { n: bookNumber })}</h1>
      {error && <ErrorState message={t("hadith.listError")} onRetry={load} />}
      {!data && !error && <div className="space-y-4">{[1,2,3].map((i) => <SkeletonCard key={i} />)}</div>}
      {data && (
        <>
          <div className="space-y-4">
            {data.hadiths?.map((h) => <HadithCard key={`${h.collection}-${h.hadithNumber}`} hadith={h} />)}
            {data.hadiths?.length === 0 && <p className="text-noor-textMuted">{t("hadith.none")}</p>}
          </div>
          <div className="flex justify-between mt-8">
            <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}
              className="px-4 py-2 rounded-full bg-noor-surface2 disabled:opacity-40">{isRTL ? "→" : "←"} {t("common.previous")}</button>
            <span className="text-xs text-noor-textMuted self-center">{t("hadith.range", { from: offset + 1, to: offset + (data.hadiths?.length || 0), total: data.total })}</span>
            <button disabled={offset + PAGE >= (data.total || 0)} onClick={() => setOffset(offset + PAGE)}
              className="px-4 py-2 rounded-full bg-noor-surface2 disabled:opacity-40">{t("common.next")} {isRTL ? "←" : "→"}</button>
          </div>
        </>
      )}
    </div>
  );
}
