import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Trash2 } from "lucide-react";
import GlassCard from "../../../components/GlassCard";
import MiniBars from "../../../components/dashboard/MiniBars";
import { ErrorState, SkeletonCard } from "../../../components/Skeleton";
import useLoad from "../../../hooks/useLoad";
import { fetchTasbeehHistory, deleteTasbeehSession } from "../../../services/contentService";
import { useI18n } from "../../../context/I18nContext";

export default function TasbeehTab() {
  const { t, locale, isRTL } = useI18n();
  const when = (iso) => new Date(iso).toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const { data, error, reload } = useLoad(fetchTasbeehHistory);
  const [failed, setFailed] = useState(false);

  if (error) return <ErrorState message={t("dtas.loadError")} onRetry={reload} />;
  if (!data) return <SkeletonCard />;

  // Totals come from the server, so after a delete we simply load them again.
  const remove = async (id) => {
    setFailed(false);
    try { await deleteTasbeehSession(id); reload(); }
    catch { setFailed(true); }
  };

  return (
    <section aria-label={t("dtas.aria")} className="space-y-4">
      <div className="grid sm:grid-cols-3 gap-4">
        <GlassCard><p className="text-xs text-noor-textMuted">{t("dtas.today")}</p><p className="text-3xl font-display">{data.todayTotal}</p></GlassCard>
        <GlassCard><p className="text-xs text-noor-textMuted">{t("tasbeeh.allTime")}</p><p className="text-3xl font-display">{data.allTimeTotal}</p></GlassCard>
        <GlassCard><p className="text-xs text-noor-textMuted">{t("dtas.sessions")}</p><p className="text-3xl font-display">{data.allTimeSessions}</p></GlassCard>
      </div>

      <GlassCard>
        <p className="text-sm mb-3">{t("progress.last7")}</p>
        <MiniBars days={data.last7.map((d) => ({ date: d.date, count: d.total }))} label={t("dtas.last7Label")} color="bg-noor-gold" />
        {data.todayByDhikr.length > 0 && (
          <p className="text-xs text-noor-textMuted mt-3">{t("tasbeeh.todayBy", { list: data.todayByDhikr.map((r) => `${r.dhikr} ${r.total}`).join(" · ") })}</p>
        )}
      </GlassCard>

      <div className="flex items-center justify-between">
        <p className="text-sm">{t("drec.recent")}</p>
        <Link to="/tasbeeh" className="text-sm text-noor-goldBright">{t("dtas.open")} {isRTL ? "←" : "→"}</Link>
      </div>
      {failed && <p role="alert" className="text-sm text-red-400">{t("dtas.deleteFail")}</p>}
      {data.sessions.length === 0 && <p className="text-sm text-noor-textMuted">{t("dtas.none")}</p>}
      <ul className="space-y-2">
        {data.sessions.map((s) => (
          <li key={s._id} className="glass-card px-4 py-3 flex items-center justify-between gap-3 text-sm">
            <div>
              <p>{s.dhikr} <span className="text-noor-goldBright">× {s.count}</span></p>
              <p className="text-xs text-noor-textMuted">{t("dtas.target", { n: s.target })} · {when(s.createdAt)}</p>
            </div>
            <button aria-label={t("dtas.deleteSession", { dhikr: s.dhikr })} onClick={() => remove(s._id)} className="text-noor-textMuted hover:text-red-400"><Trash2 size={16} /></button>
          </li>
        ))}
      </ul>
    </section>
  );
}
