import React from "react";
import { Link } from "react-router-dom";
import GlassCard from "../../../components/GlassCard";
import { ErrorState, SkeletonCard } from "../../../components/Skeleton";
import useLoad from "../../../hooks/useLoad";
import { fetchPrayerHistory } from "../../../services/contentService";
import { useI18n } from "../../../context/I18nContext";

const PRAYERS = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
const SHOWN_DAYS = 14;

export default function PrayerTab() {
  const { t, locale, isRTL } = useI18n();
  const dayText = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  const { data, error, reload } = useLoad(() => fetchPrayerHistory(30));

  if (error) return <ErrorState message={t("dprayer.loadError")} onRetry={reload} />;
  if (!data) return <SkeletonCard />;

  const recent = [...data.days].slice(-SHOWN_DAYS).reverse(); // newest first

  return (
    <section aria-label={t("dprayer.aria")} className="space-y-4">
      <div className="grid sm:grid-cols-3 gap-4">
        <GlassCard><p className="text-xs text-noor-textMuted">{t("dprayer.logged30")}</p><p className="text-3xl font-display">{data.totalLogged}</p></GlassCard>
        <GlassCard><p className="text-xs text-noor-textMuted">{t("dprayer.full")}</p><p className="text-3xl font-display">{data.fullDays}</p></GlassCard>
        <GlassCard><p className="text-xs text-noor-textMuted">{t("dprayer.run")}</p><p className="text-3xl font-display">{data.streak}</p></GlassCard>
      </div>

      <GlassCard>
        <p className="text-sm mb-3">{t("dprayer.per")}</p>
        <div className="grid grid-cols-5 gap-2 text-center">
          {PRAYERS.map((p) => (
            <div key={p}><p className="text-xl font-display">{data.perPrayer[p]}</p><p className="text-xs text-noor-textMuted">{t(`pn.${p}`)}</p></div>
          ))}
        </div>
      </GlassCard>

      <GlassCard className="overflow-x-auto">
        <p className="text-sm mb-3">{t("dprayer.lastN", { n: SHOWN_DAYS })}</p>
        <table className="w-full text-sm min-w-[420px]">
          <caption className="sr-only">{t("dprayer.caption", { n: SHOWN_DAYS })}</caption>
          <thead>
            <tr className="text-xs text-noor-textMuted text-start">
              <th scope="col" className="font-normal pb-2">{t("dprayer.day")}</th>
              {PRAYERS.map((p) => <th key={p} scope="col" className="font-normal pb-2 text-center">{t(`pn.${p}`)}</th>)}
            </tr>
          </thead>
          <tbody>
            {recent.map((d) => (
              <tr key={d.date} className="border-t border-noor-border">
                <th scope="row" className="font-normal py-2 text-start">{dayText(d.date)}</th>
                {PRAYERS.map((p) => (
                  <td key={p} className="text-center">
                    <span aria-label={d.done[p] ? t("dprayer.logged") : t("dprayer.notLogged")} className={d.done[p] ? "text-emerald-400" : "text-noor-border"}>{d.done[p] ? "✓" : "·"}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </GlassCard>

      <p className="text-xs text-noor-textMuted">
        {t("dprayer.note")}{" "}
        <Link to="/prayer" className="text-noor-goldBright">{t("dprayer.logToday")} {isRTL ? "←" : "→"}</Link>
      </p>
    </section>
  );
}
