import React, { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Flame } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import GlassCard from "../../components/GlassCard";
import { ErrorState, SkeletonCard } from "../../components/Skeleton";
import { useToast } from "../../components/Toast";
import { fetchProgressStats, resetProgress } from "../../services/contentService";
import { useI18n } from "../../context/I18nContext";

function Bar({ percent, label }) {
  return (
    <div role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={label}
      className="h-3 rounded-full bg-noor-surface2 overflow-hidden">
      <div className="h-full bg-noor-emeraldBright transition-all" style={{ width: `${percent}%` }} />
    </div>
  );
}

const weekday = (dateStr, locale) => new Date(dateStr + "T00:00:00").toLocaleDateString(locale, { weekday: "short" });

export default function Progress() {
  const { t, isRTL, locale } = useI18n();
  const { user, loading: authLoading } = useAuth();
  const { toastEl, notify } = useToast();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(false);

  function load() {
    setError(false);
    fetchProgressStats().then(setStats).catch(() => setError(true));
  }

  useEffect(() => { if (user) load(); }, [user]);

  if (authLoading) return <p className="text-center py-24 text-noor-textMuted">{t("common.loading")}</p>;
  if (!user) return <Navigate to="/login" replace />;

  async function startNew() {
    const finished = stats.khatmPercent >= 100;
    const message = finished ? t("progress.confirmNew") : t("progress.confirmReset");
    if (!window.confirm(message)) return;
    try {
      setStats(await resetProgress());
      notify(t("progress.resetDone"));
    } catch {
      notify(t("progress.resetFail"));
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 space-y-8">
      {toastEl}
      <div>
        <p className="text-xs uppercase tracking-wide text-noor-textMuted">{t("common.mySiraj")}</p>
        <h1 className="text-3xl font-display text-noor-goldBright">{t("progress.title")}</h1>
      </div>

      {error && <ErrorState message={t("progress.loadError")} onRetry={load} />}
      {!stats && !error && <SkeletonCard />}

      {stats && (
        <>
          <GlassCard className="shadow-glow">
            <p className="text-xs text-noor-textMuted mb-1">{t("progress.khatm")}</p>
            <p className="text-5xl font-display text-noor-goldBright mb-4">{stats.khatmPercent}%</p>
            <Bar percent={stats.khatmPercent} label={t("progress.khatm")} />
            <p className="text-xs text-noor-textMuted mt-3">
              {t("progress.khatmNote")}
              {stats.khatmCount > 0 && ` ${t("progress.khatmCount", { n: stats.khatmCount })}`}
            </p>
            {stats.khatmPercent >= 100 && <p className="mt-3 text-noor-goldBright">{t("progress.congrats")}</p>}
          </GlassCard>

          <div className="grid sm:grid-cols-3 gap-4">
            <GlassCard>
              <p className="text-xs text-noor-textMuted mb-1">{t("progress.surahs")}</p>
              <p className="text-2xl font-display mb-2">{stats.surahsDone} / 114</p>
              <Bar percent={stats.surahPercent} label={t("progress.surahsDone")} />
              {stats.ayahsRead !== null && <p className="text-xs text-noor-textMuted mt-2">{t("progress.ayahsRead", { n: stats.ayahsRead, total: stats.totalAyahs })}</p>}
            </GlassCard>
            <GlassCard>
              <p className="text-xs text-noor-textMuted mb-1">{t("progress.juz")}</p>
              <p className="text-2xl font-display mb-2">{stats.juzDone} / 30</p>
              <Bar percent={stats.juzPercent} label={t("progress.juzDone")} />
            </GlassCard>
            <GlassCard>
              <p className="text-xs text-noor-textMuted mb-1 flex items-center gap-1"><Flame size={14} /> {t("progress.streak")}</p>
              <p className="text-2xl font-display mb-1">{t(stats.streak.current === 1 ? "progress.day" : "progress.days", { n: stats.streak.current })}</p>
              <p className="text-xs text-noor-textMuted">{t("progress.streakMeta", { longest: stats.streak.longest, active: stats.activeDays30 })}</p>
            </GlassCard>
          </div>

          <GlassCard>
            <p className="text-xs text-noor-textMuted mb-3">{t("progress.last7")}</p>
            <div className="flex justify-between gap-2">
              {stats.last7.map((d) => (
                <div key={d.date} className="flex flex-col items-center gap-1 text-xs text-noor-textMuted">
                  <span aria-label={t(d.active ? "progress.dayRead" : "progress.dayNone", { date: d.date })}
                    className={`w-9 h-9 rounded-full flex items-center justify-center border ${d.active ? "bg-noor-emeraldBright border-noor-emeraldBright text-white" : "border-noor-border"}`}>
                    {d.active ? "✓" : ""}
                  </span>
                  {weekday(d.date, locale)}
                </div>
              ))}
            </div>
            <p className="text-xs text-noor-textMuted mt-4">{t("progress.dayNote")}</p>
          </GlassCard>

          <section>
            <h2 className="text-xl mb-3">{t("progress.surahsDone")}</h2>
            <div className="grid grid-cols-8 sm:grid-cols-12 gap-1.5">
              {Array.from({ length: 114 }, (_, i) => i + 1).map((n) => {
                const done = stats.surahsCompleted.includes(n);
                return (
                  <Link key={n} to={`/quran/${n}`} aria-label={t(done ? "progress.surahLabelDone" : "progress.surahLabel", { n })}
                    className={`text-center text-xs py-2 rounded-md border ${done ? "bg-noor-emeraldBright/80 border-noor-emeraldBright text-white" : "border-noor-border text-noor-textMuted hover:bg-noor-surface2"}`}>
                    {n}
                  </Link>
                );
              })}
            </div>
          </section>

          <section>
            <h2 className="text-xl mb-3">{t("progress.juzDone")}</h2>
            <div className="grid grid-cols-6 sm:grid-cols-10 gap-1.5">
              {Array.from({ length: 30 }, (_, i) => i + 1).map((n) => {
                const done = stats.juzCompleted.includes(n);
                return (
                  <Link key={n} to={`/quran/juz/${n}`} aria-label={t(done ? "progress.juzLabelDone" : "progress.juzLabel", { n })}
                    className={`text-center text-xs py-2 rounded-md border ${done ? "bg-noor-emeraldBright/80 border-noor-emeraldBright text-white" : "border-noor-border text-noor-textMuted hover:bg-noor-surface2"}`}>
                    {n}
                  </Link>
                );
              })}
            </div>
          </section>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link to={`/quran/${stats.lastSurahNumber}?ayah=${stats.lastAyahNumber}`} className="text-sm text-noor-goldBright">
              {t("progress.continue", { s: stats.lastSurahNumber, a: stats.lastAyahNumber })} {isRTL ? "←" : "→"}
            </Link>
            <button onClick={startNew} className="px-4 py-2 rounded-full border border-noor-border text-sm hover:bg-noor-surface2">
              {stats.khatmPercent >= 100 ? t("progress.newKhatm") : t("progress.reset")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
