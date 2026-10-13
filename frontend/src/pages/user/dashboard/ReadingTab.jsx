import React from "react";
import { Link } from "react-router-dom";
import GlassCard from "../../../components/GlassCard";
import Heatmap from "../../../components/dashboard/Heatmap";
import { ErrorState, SkeletonCard } from "../../../components/Skeleton";
import useLoad from "../../../hooks/useLoad";
import { fetchReadingHistory } from "../../../services/contentService";
import { useI18n } from "../../../context/I18nContext";

const DAYS = 84; // 12 weeks

export default function ReadingTab() {
  const { t, locale, isRTL } = useI18n();
  const { data, error, reload } = useLoad(() => fetchReadingHistory(DAYS));

  if (error) return <ErrorState message={t("reading.loadError")} onRetry={reload} />;
  if (!data) return <SkeletonCard />;

  const lastRead = data.lastReadAt ? new Date(data.lastReadAt).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" }) : null;

  return (
    <section aria-label={t("reading.aria")} className="space-y-4">
      <div className="grid sm:grid-cols-3 gap-4">
        <GlassCard><p className="text-xs text-noor-textMuted">{t("reading.active")}</p><p className="text-3xl font-display">{data.activeDays}</p></GlassCard>
        <GlassCard><p className="text-xs text-noor-textMuted">{t("reading.current")}</p><p className="text-3xl font-display">{data.streak.current}</p></GlassCard>
        <GlassCard><p className="text-xs text-noor-textMuted">{t("reading.longest")}</p><p className="text-3xl font-display">{data.streak.longest}</p></GlassCard>
      </div>

      <GlassCard>
        <p className="text-sm mb-3">{t("reading.days")}</p>
        <Heatmap days={data.days} label={t("reading.heat")} />
        <p className="text-xs text-noor-textMuted mt-3">
          {t("reading.note")}
        </p>
      </GlassCard>

      <GlassCard className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-noor-textMuted">{t("reading.stopped")}</p>
          <p>{t("ov.surahAyah", { s: data.lastSurahNumber, a: data.lastAyahNumber })}</p>
          {lastRead && <p className="text-xs text-noor-textMuted">{t("reading.updated", { when: lastRead })}</p>}
        </div>
        <Link to={`/quran/${data.lastSurahNumber}?ayah=${data.lastAyahNumber}`} className="px-4 py-2 rounded-full bg-noor-gold text-noor-onAccent text-sm font-medium hover:bg-noor-goldBright">{t("ov.resume")} {isRTL ? "←" : "→"}</Link>
      </GlassCard>
    </section>
  );
}
