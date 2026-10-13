import React from "react";
import MiniBars from "../../../components/dashboard/MiniBars";
import { ErrorState, SkeletonCard } from "../../../components/Skeleton";
import useLoad from "../../../hooks/useLoad";
import { adminOverview } from "../../../services/contentService";
import { healthClass } from "../../../utils/adminFormat";

function Stat({ label, value, hint }) {
  return (
    <div className="glass-card p-5">
      <p className="text-xs text-noor-textMuted">{label}</p>
      <p className="text-3xl font-display text-noor-goldBright">{value ?? "—"}</p>
      {hint && <p className="text-xs text-noor-textMuted mt-1">{hint}</p>}
    </div>
  );
}

function Chart({ title, days, field, color }) {
  const data = days.map((d) => ({ date: d.date, count: d[field] }));
  const total = data.reduce((s, d) => s + d.count, 0);
  return (
    <div className="glass-card p-5">
      <div className="flex justify-between items-baseline mb-3">
        <p className="text-sm">{title}</p>
        <p className="text-xs text-noor-textMuted">14 days: {total}</p>
      </div>
      <MiniBars days={data} label={`${title}, last 14 days`} color={color} />
    </div>
  );
}

export default function DashboardSection({ goTab }) {
  const { data: s, error, reload } = useLoad(adminOverview);
  if (error) return <ErrorState message="Unable to load the statistics. Please try again." onRetry={reload} />;
  if (!s) return <div className="grid grid-cols-2 md:grid-cols-4 gap-4"><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Total users" value={s.users.total} hint={`${s.users.deactivated} deactivated`} />
        <Stat label="Active accounts" value={s.users.activeAccounts} />
        <Stat label="New (7 days)" value={s.users.new7d} />
        <button onClick={() => goTab("system-status")} className="glass-card p-5 text-left hover:shadow-emeraldGlow">
          <p className="text-xs text-noor-textMuted">System health</p>
          <p className={`text-xl font-display ${healthClass(s.health.level)}`}>● {s.health.label}</p>
          <p className="text-xs text-noor-textMuted mt-1">Details →</p>
        </button>

        <Stat label="Active today" value={s.activity.activeToday} hint="Used reading, Tasbeeh or prayer tracking" />
        <Stat label="Active (7 days)" value={s.activity.active7d} />
        <Stat label="Active (30 days)" value={s.activity.active30d} />
        <Stat label="Quran readers" value={s.quran.readers} hint={`${s.quran.readingActions30d} reading actions in 30 days`} />

        <Stat label="Tasbeeh sessions" value={s.tasbeeh.sessions} hint={`${s.tasbeeh.totalCount} counts in total`} />
        <Stat label="Saved items" value={s.bookmarks.total} hint={`Quran ${s.bookmarks.AYAH + s.bookmarks.SURAH} · Hadith ${s.bookmarks.HADITH} · Duas ${s.bookmarks.DUA}`} />
        <Stat label="Notes" value={s.notes} />
        <Stat label="Prayers logged (30 days)" value={s.prayersLogged30d} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Chart title="Daily active users" days={s.daily} field="activeUsers" color="bg-noor-emeraldBright" />
        <Chart title="New sign-ups" days={s.daily} field="signups" color="bg-noor-gold" />
        <Chart title="Quran reading actions" days={s.daily} field="readingActions" color="bg-emerald-500" />
        <Chart title="Tasbeeh sessions saved" days={s.daily} field="tasbeehSessions" color="bg-noor-goldBright" />
      </div>

      <p className="text-xs text-noor-textMuted">
        “Active” means a logged-in user marked reading progress, saved a Tasbeeh session or ticked a prayer that day. SIRAJ does not count page views,
        so there is no “Hadith reads” number — the Hadith figure here is how many Hadith users saved. Sign-up days are UTC.
      </p>
    </div>
  );
}
