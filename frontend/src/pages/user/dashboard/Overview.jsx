import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Flame, BookOpen, Bell, Settings, Target } from "lucide-react";
import TiltCard from "../../../components/dashboard/TiltCard";
import ProgressRing from "../../../components/dashboard/ProgressRing";
import MiniBars from "../../../components/dashboard/MiniBars";
import { ErrorState, SkeletonCard } from "../../../components/Skeleton";
import useLoad from "../../../hooks/useLoad";
import { fetchDashboardSummary } from "../../../services/contentService";
import { fetchSurahs } from "../../../services/quranService";
import { percentOf } from "../../../utils/dashboard";
import { useI18n } from "../../../context/I18nContext";

export default function Overview({ goTab }) {
  const { t, lang, locale, isRTL } = useI18n();
  const dayLabel = (iso) => new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short" });
  const arrow = isRTL ? "←" : "→";
  const { data, error, reload } = useLoad(fetchDashboardSummary);
  const [surahs, setSurahs] = useState(null);
  useEffect(() => { fetchSurahs().then(setSurahs).catch(() => {}); }, []); // only used for the Surah name

  if (error) return <ErrorState message={t("ov.loadError")} onRetry={reload} />;
  if (!data) {
    return <div className="grid sm:grid-cols-3 gap-4"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>;
  }

  const { quran, bookmarks, notesCount, notifications, tasbeeh, prayer, prayerSettings, goals } = data;
  const found = surahs?.find((s) => s.number === quran.lastSurahNumber);
  const surahName = found ? (lang === "en" ? found.englishName : found.name) : null;
  const resume = `/quran/${quran.lastSurahNumber}?ayah=${quran.lastAyahNumber}`;
  const prayerWeekFull = prayer.last7.filter((d) => d.count === 5).length;

  return (
    <div className="space-y-6">
      {/* Row 1: reading */}
      <div className="grid md:grid-cols-3 gap-4">
        <TiltCard className="md:col-span-1 flex flex-col justify-between">
          <div>
            <p className="text-xs text-noor-textMuted mb-1 flex items-center gap-1.5"><BookOpen size={14} aria-hidden="true" /> {t("ov.continue")}</p>
            <p className="text-2xl font-display text-noor-goldBright">{surahName || t("common.surahN", { n: quran.lastSurahNumber })}</p>
            <p className="text-sm text-noor-textMuted">{t("ov.surahAyah", { s: quran.lastSurahNumber, a: quran.lastAyahNumber })}</p>
          </div>
          <Link to={resume} className="mt-4 inline-block self-start px-4 py-2 rounded-full bg-noor-gold text-noor-onAccent text-sm font-medium hover:bg-noor-goldBright">{t("ov.resume")} {arrow}</Link>
        </TiltCard>

        <TiltCard className="flex items-center gap-5">
          <ProgressRing percent={quran.khatmPercent} label={t("ov.ringLabel", { n: quran.khatmPercent })}>
            <span className="text-2xl font-display text-noor-goldBright">{quran.khatmPercent}%</span>
          </ProgressRing>
          <div className="text-sm">
            <p className="text-xs text-noor-textMuted mb-1">{t("progress.title")}</p>
            <p>{t("ov.surahsOf", { n: quran.surahsDone })}</p>
            <p>{t("ov.juzOf", { n: quran.juzDone })}</p>
            {quran.khatmCount > 0 && <p className="text-xs text-noor-textMuted mt-1">{t("ov.khatm", { n: quran.khatmCount })}</p>}
            <Link to="/progress" className="text-xs text-noor-goldBright">{t("ov.details")} {arrow}</Link>
          </div>
        </TiltCard>

        <TiltCard>
          <p className="text-xs text-noor-textMuted mb-1 flex items-center gap-1.5"><Flame size={14} aria-hidden="true" /> {t("progress.streak")}</p>
          <p className="text-4xl font-display">{quran.streak.current} <span className="text-base text-noor-textMuted">{t(quran.streak.current === 1 ? "progress.day" : "progress.days", { n: "" }).trim()}</span></p>
          <p className="text-xs text-noor-textMuted mb-3">{t("ov.longest", { n: quran.streak.longest })}</p>
          <div className="flex gap-1.5" role="img" aria-label={t("ov.readLast7", { n: quran.last7.filter((d) => d.active).length })}>
            {quran.last7.map((d) => (
              <span key={d.date} title={d.date} className={`flex-1 h-2 rounded-full ${d.active ? "bg-noor-gold" : "bg-noor-surface2"}`} />
            ))}
          </div>
        </TiltCard>
      </div>

      {/* Row 2: worship tracking */}
      <div className="grid md:grid-cols-2 gap-4">
        <TiltCard>
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs text-noor-textMuted">{t("ov.prayersToday")}</p>
              <p className="text-3xl font-display">{prayer.todayCount} <span className="text-base text-noor-textMuted">/ 5</span></p>
              <p className="text-xs text-noor-textMuted">{t(prayerWeekFull === 1 ? "ov.fullDay1" : "ov.fullDayN", { n: prayerWeekFull })}</p>
            </div>
            <button onClick={() => goTab("prayer")} className="text-xs text-noor-goldBright">{t("ov.history")} {arrow}</button>
          </div>
          <MiniBars days={prayer.last7} maxValue={5} label={t("ov.prayers7")} />
        </TiltCard>

        <TiltCard>
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs text-noor-textMuted">{t("ov.tasbeehToday")}</p>
              <p className="text-3xl font-display">{tasbeeh.todayTotal}</p>
              <p className="text-xs text-noor-textMuted">{t(tasbeeh.allTimeSessions === 1 ? "ov.allTime1" : "ov.allTimeN", { total: tasbeeh.allTimeTotal, n: tasbeeh.allTimeSessions })}</p>
            </div>
            <button onClick={() => goTab("tasbeeh")} className="text-xs text-noor-goldBright">{t("ov.history")} {arrow}</button>
          </div>
          <MiniBars days={tasbeeh.last7} label={t("ov.tasbeeh7")} color="bg-noor-gold" />
        </TiltCard>
      </div>

      {/* Row 3: goals + counts */}
      <div className="grid md:grid-cols-3 gap-4">
        <TiltCard className="md:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm flex items-center gap-2"><Target size={16} className="text-noor-goldBright" aria-hidden="true" /> {t("ov.goalsTitle")}</p>
            <Link to="/goals" className="text-xs text-noor-goldBright">{goals.length ? t("ov.manage") : t("ov.setGoal")} {arrow}</Link>
          </div>
          {goals.length === 0 && <p className="text-sm text-noor-textMuted">{t("ov.noGoals")}</p>}
          <div className="space-y-3">
            {goals.map((g) => {
              const pct = percentOf(g.current, g.target);
              return (
                <div key={g.type}>
                  <div className="flex justify-between text-xs mb-1">
                    <span>{t(`goals.label.${g.type}`)}</span>
                    <span className={g.done ? "text-emerald-400" : "text-noor-textMuted"}>{g.current} / {g.target}{g.done ? " ✓" : ""}</span>
                  </div>
                  <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={t(`goals.label.${g.type}`)} className="h-2 rounded-full bg-noor-surface2 overflow-hidden">
                    <div className="h-full bg-noor-gold transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </TiltCard>

        <div className="grid grid-cols-3 md:grid-cols-1 gap-3">
          <button onClick={() => goTab("saved")} className="glass-card px-4 py-3 text-start hover:shadow-emeraldGlow">
            <span className="block text-2xl font-display">{bookmarks.total}</span><span className="text-xs text-noor-textMuted">{t("ov.savedItems")}</span>
          </button>
          <button onClick={() => goTab("notes")} className="glass-card px-4 py-3 text-start hover:shadow-emeraldGlow">
            <span className="block text-2xl font-display">{notesCount}</span><span className="text-xs text-noor-textMuted">{t("ov.notes")}</span>
          </button>
          <Link to="/notifications" className="glass-card px-4 py-3 text-start hover:shadow-emeraldGlow">
            <span className="block text-2xl font-display">{notifications.unreadCount}</span><span className="text-xs text-noor-textMuted">{t("ov.unread")}</span>
          </Link>
        </div>
      </div>

      {/* Row 4: notifications + prayer settings */}
      <div className="grid md:grid-cols-2 gap-4">
        <TiltCard>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm flex items-center gap-2"><Bell size={16} className="text-noor-goldBright" aria-hidden="true" /> {t("ov.latest")}</p>
            <Link to="/notifications" className="text-xs text-noor-goldBright">{t("ov.seeAll")} {arrow}</Link>
          </div>
          {notifications.latest.length === 0 && <p className="text-sm text-noor-textMuted">{t("ov.nothingNew")}</p>}
          <ul className="space-y-2">
            {notifications.latest.map((n) => (
              <li key={n._id} className="text-sm">
                <Link to={n.link || "/notifications"} className="flex gap-2 hover:text-noor-goldBright">
                  <span aria-hidden="true" className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${n.read ? "bg-noor-surface2" : "bg-noor-gold"}`} />
                  <span><span className="block">{n.title}</span><span className="text-xs text-noor-textMuted">{dayLabel(n.createdAt)}</span></span>
                </Link>
              </li>
            ))}
          </ul>
        </TiltCard>

        <TiltCard>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm flex items-center gap-2"><Settings size={16} className="text-noor-goldBright" aria-hidden="true" /> {t("ov.prayerSettings")}</p>
            <Link to="/prayer" className="text-xs text-noor-goldBright">{t("ov.change")} {arrow}</Link>
          </div>
          {!prayerSettings ? (
            <p className="text-sm text-noor-textMuted">{t("ov.defaults")}</p>
          ) : (
            <dl className="text-sm grid grid-cols-[auto,1fr] gap-x-4 gap-y-1.5">
              <dt className="text-noor-textMuted">{t("ov.method")}</dt><dd>{t(`method.${prayerSettings.method}`) !== `method.${prayerSettings.method}` ? t(`method.${prayerSettings.method}`) : t("method.other", { id: prayerSettings.method })}</dd>
              <dt className="text-noor-textMuted">{t("ov.madhab")}</dt><dd>{t(prayerSettings.school === 1 ? "madhab.hanafi" : "madhab.other")}</dd>
              <dt className="text-noor-textMuted">{t("ov.reminders")}</dt>
              <dd>{prayerSettings.notificationsEnabled ? (prayerSettings.minutesBefore ? t("ov.remindersOnMin", { n: prayerSettings.minutesBefore }) : t("ov.on")) : t("ov.off")}</dd>
              <dt className="text-noor-textMuted">{t("ov.adhan")}</dt><dd>{prayerSettings.adhanEnabled ? t("ov.on") : t("ov.off")}</dd>
              {prayerSettings.city && (<><dt className="text-noor-textMuted">{t("ov.city")}</dt><dd>{prayerSettings.city}{prayerSettings.country ? `, ${prayerSettings.country}` : ""}</dd></>)}
            </dl>
          )}
        </TiltCard>
      </div>
    </div>
  );
}
