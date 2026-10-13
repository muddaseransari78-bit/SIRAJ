import React from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Overview from "./dashboard/Overview";
import SavedTab from "./dashboard/SavedTab";
import NotesTab from "./dashboard/NotesTab";
import ReadingTab from "./dashboard/ReadingTab";
import TasbeehTab from "./dashboard/TasbeehTab";
import PrayerTab from "./dashboard/PrayerTab";
import RecitationTab from "./dashboard/RecitationTab";
import { useI18n } from "../../context/I18nContext";

const TABS = ["overview", "saved", "notes", "reading", "tasbeeh", "prayer", "recitation"].map((key) => ({ key, label: `dash.tab.${key}` }));

const SHORTCUTS = [
  { to: "/goals", label: "dash.goals" },
  { to: "/notifications", label: "dash.notifications" },
  { to: "/ramadan", label: "dash.ramadan" },
  { to: "/profile", label: "dash.profile" },
];

export default function Dashboard() {
  const { user, loading, logout } = useAuth();
  const { t: tr } = useI18n();
  const [params, setParams] = useSearchParams();

  if (loading) return <p className="text-center py-24 text-noor-textMuted">{tr("common.loading")}</p>;
  if (!user) return <Navigate to="/login" replace />;

  // The open tab lives in the address (?tab=prayer) so refresh and the Back button keep working.
  const requested = params.get("tab");
  const tab = TABS.some((t) => t.key === requested) ? requested : "overview";
  const goTab = (key) => setParams(key === "overview" ? {} : { tab: key });

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-noor-textMuted">{tr("common.mySiraj")}</p>
          <h1 className="text-3xl font-display text-noor-goldBright">{tr("dash.hello", { name: user.name.split(" ")[0] })}</h1>
        </div>
        <button onClick={logout} className="px-4 py-2 rounded-full border border-noor-border text-sm hover:bg-noor-surface2">{tr("dash.logout")}</button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        {SHORTCUTS.map((s) => (
          <Link key={s.to} to={s.to} className="glass-card px-4 py-3 hover:shadow-emeraldGlow">{tr(s.label)}</Link>
        ))}
      </div>

      <div role="tablist" aria-label={tr("dash.sections")} className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.key} role="tab" id={`tab-${t.key}`} aria-selected={tab === t.key} aria-controls="dashboard-panel"
            onClick={() => goTab(t.key)}
            className={`px-4 py-2 rounded-full text-sm whitespace-nowrap border transition-colors ${
              tab === t.key ? "bg-noor-gold text-noor-onAccent border-noor-gold" : "border-noor-border text-noor-textMuted hover:text-noor-text"
            }`}
          >
            {tr(t.label)}
          </button>
        ))}
      </div>

      <div role="tabpanel" id="dashboard-panel" aria-labelledby={`tab-${tab}`}>
        {tab === "overview" && <Overview goTab={goTab} />}
        {tab === "saved" && <SavedTab />}
        {tab === "notes" && <NotesTab />}
        {tab === "reading" && <ReadingTab />}
        {tab === "tasbeeh" && <TasbeehTab />}
        {tab === "prayer" && <PrayerTab />}
        {tab === "recitation" && <RecitationTab />}
      </div>
    </div>
  );
}
