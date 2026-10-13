import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Trash2 } from "lucide-react";
import GlassCard from "../../../components/GlassCard";
import MiniBars from "../../../components/dashboard/MiniBars";
import { ErrorState, SkeletonCard } from "../../../components/Skeleton";
import useLoad from "../../../hooks/useLoad";
import { fetchRecitationSessions, deleteRecitationSession } from "../../../services/recitationService";
import { fetchSurahs } from "../../../services/quranService";
import { ayahsToRepeat } from "../../../utils/recitationSession";
import { localDate } from "../../../utils/date";
import { useI18n } from "../../../context/I18nContext";

export default function RecitationTab() {
  const { t, lang, locale, isRTL } = useI18n();
  const when = (iso) => new Date(iso).toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const { data, error, reload } = useLoad(() => fetchRecitationSessions(localDate()));
  const [surahs, setSurahs] = useState([]);
  const [failed, setFailed] = useState(false);
  useEffect(() => { fetchSurahs().then(setSurahs).catch(() => {}); }, []); // only used for Surah names

  if (error) return <ErrorState message={t("drec.loadError")} onRetry={reload} />;
  if (!data) return <SkeletonCard />;

  const nameOf = (n) => { const s = surahs.find((x) => x.number === n); return s ? (lang === "en" ? s.englishName : s.name) : t("common.surahN", { n }); };
  // Totals come from the server, so after a delete we simply load them again.
  const remove = async (id) => {
    setFailed(false);
    try { await deleteRecitationSession(id); reload(); } catch { setFailed(true); }
  };

  return (
    <section aria-label={t("drec.aria")} className="space-y-4">
      <div className="grid sm:grid-cols-3 gap-4">
        <GlassCard><p className="text-xs text-noor-textMuted">{t("drec.sessions")}</p><p className="text-3xl font-display">{data.totals.sessions}</p></GlassCard>
        <GlassCard><p className="text-xs text-noor-textMuted">{t("drec.ayahs")}</p><p className="text-3xl font-display">{data.totals.ayahsPracticed}</p></GlassCard>
        <GlassCard><p className="text-xs text-noor-textMuted">{t("drec.avg")}</p><p className="text-3xl font-display">{data.totals.averageScore}%</p></GlassCard>
      </div>

      <GlassCard>
        <p className="text-sm mb-3">{t("drec.last14")}</p>
        <MiniBars days={data.last14.map((d) => ({ date: d.date, count: d.ayahs }))} label={t("drec.last14Label")} />
      </GlassCard>

      <div className="flex items-center justify-between">
        <p className="text-sm">{t("drec.recent")}</p>
        <Link to="/recitation/live" className="text-sm text-noor-goldBright">{t("drec.practiseNow")} {isRTL ? "←" : "→"}</Link>
      </div>
      {failed && <p role="alert" className="text-sm text-red-400">{t("drec.deleteFail")}</p>}
      {data.sessions.length === 0 && <p className="text-sm text-noor-textMuted">{t("drec.none")}</p>}

      <ul className="space-y-2">
        {data.sessions.map((s) => {
          const repeat = ayahsToRepeat(s.ayahs);
          return (
            <li key={s._id} className="glass-card px-4 py-3 flex items-start justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p>
                  <Link to={`/recitation/live`} className="text-noor-goldBright">{nameOf(s.surahNumber)}</Link>
                  <span className="text-noor-textMuted"> · {t(s.ayahs.length === 1 ? "drec.row1" : "drec.rowN", { n: s.ayahs.length, score: s.averageScore })}</span>
                </p>
                <p className="text-xs text-noor-textMuted">{when(s.createdAt)}{repeat.length > 0 ? ` · ${t("drec.again", { list: `${repeat.slice(0, 8).join(", ")}${repeat.length > 8 ? "…" : ""}` })}` : ""}</p>
              </div>
              <button aria-label={t("drec.deleteSession", { name: nameOf(s.surahNumber) })} onClick={() => remove(s._id)} className="text-noor-textMuted hover:text-red-400"><Trash2 size={16} /></button>
            </li>
          );
        })}
      </ul>

      <p className="text-xs text-noor-textMuted">
        {t("drec.note")}
      </p>
    </section>
  );
}
