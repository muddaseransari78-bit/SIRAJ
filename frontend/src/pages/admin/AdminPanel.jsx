import React from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import ThemeSwitcher from "../../components/ThemeSwitcher";
import DashboardSection from "./sections/DashboardSection";
import UsersSection from "./sections/UsersSection";
import SourcesSection from "./sections/SourcesSection";
import ReportsSection from "./sections/ReportsSection";
import SettingsSection from "./sections/SettingsSection";
import AuditSection from "./sections/AuditSection";
import FeedbackSection from "./sections/FeedbackSection";
import { SystemStatus, ApiStatus } from "./sections/StatusSections";
import { Announcements, DuasAdmin, RemindersAdmin, ErrorLogs, Broadcast } from "./sections/ContentSections";

// Sidebar groups. `key` is what appears in the address: /admin?tab=users
const GROUPS = [
  { title: "Overview", items: [{ key: "dashboard", label: "Dashboard" }, { key: "reports", label: "Reports" }] },
  { title: "People", items: [{ key: "users", label: "Users" }] },
  {
    title: "Content",
    items: [
      { key: "quran", label: "Quran" }, { key: "hadith", label: "Hadith" }, { key: "tafseer", label: "Tafseer" },
      { key: "duas", label: "Duas" }, { key: "reminders", label: "Daily Reminders" }, { key: "announcements", label: "Announcements" },
    ],
  },
  { title: "Messages", items: [{ key: "notifications", label: "Notifications" }, { key: "feedback", label: "User Feedback" }] },
  {
    title: "System",
    items: [
      { key: "settings", label: "Settings" }, { key: "system-status", label: "System Status" }, { key: "api-status", label: "API Status" },
      { key: "error-logs", label: "Error Logs" }, { key: "audit-log", label: "Audit Log" },
    ],
  },
];
const ALL = GROUPS.flatMap((g) => g.items);

export default function AdminPanel() {
  const { user, loading, logout } = useAuth();
  const [params, setParams] = useSearchParams();

  if (loading) return <p className="text-center py-24 text-noor-textMuted">Loading…</p>;
  if (!user || !["ADMIN", "SUPER_ADMIN"].includes(user.role)) return <Navigate to="/login" replace />;

  // The open section lives in the address, so refresh and the Back button keep working.
  const requested = params.get("tab");
  const tab = ALL.some((i) => i.key === requested) ? requested : "dashboard";
  const goTab = (key) => setParams(key === "dashboard" ? {} : { tab: key });
  const title = ALL.find((i) => i.key === tab).label;

  return (
    <div className="min-h-screen bg-noor-bg text-noor-text">
      <header className="border-b border-noor-border bg-noor-surface">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="font-display text-lg text-noor-goldBright">🕯️ SIRAJ Admin <span className="text-xs text-noor-textMuted">({user.role})</span></span>
          <div className="flex items-center gap-4 text-sm">
            <ThemeSwitcher />
            <Link to="/" className="text-noor-textMuted hover:text-noor-text">View site</Link>
            <button onClick={logout} className="text-noor-textMuted hover:text-noor-text">Log out</button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8 grid md:grid-cols-[210px_1fr] gap-6">
        <nav aria-label="Admin sections" className="space-y-4 md:sticky md:top-6 self-start">
          {GROUPS.map((g) => (
            <div key={g.title}>
              <p className="text-[11px] uppercase tracking-wide text-noor-textMuted mb-1.5">{g.title}</p>
              <div className="flex md:flex-col gap-1.5 overflow-x-auto">
                {g.items.map((i) => (
                  <button
                    key={i.key} onClick={() => goTab(i.key)} aria-current={tab === i.key ? "page" : undefined}
                    className={`text-left px-3 py-2 rounded-lg text-sm whitespace-nowrap ${tab === i.key ? "bg-noor-gold text-noor-onAccent" : "bg-noor-surface2 text-noor-textMuted hover:text-noor-text"}`}
                  >
                    {i.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <main className="min-w-0">
          <h1 className="text-2xl font-display mb-4">{title}</h1>
          {tab === "dashboard" && <DashboardSection goTab={goTab} />}
          {tab === "reports" && <ReportsSection />}
          {tab === "users" && <UsersSection me={user} />}
          {tab === "quran" && <SourcesSection kind="quran" me={user} goTab={goTab} />}
          {tab === "hadith" && <SourcesSection kind="hadith" me={user} goTab={goTab} />}
          {tab === "tafseer" && <SourcesSection kind="tafseer" me={user} goTab={goTab} />}
          {tab === "duas" && <DuasAdmin />}
          {tab === "reminders" && <RemindersAdmin />}
          {tab === "announcements" && <Announcements />}
          {tab === "notifications" && <Broadcast />}
          {tab === "feedback" && <FeedbackSection />}
          {tab === "settings" && <SettingsSection me={user} />}
          {tab === "system-status" && <SystemStatus />}
          {tab === "api-status" && <ApiStatus />}
          {tab === "error-logs" && <ErrorLogs me={user} />}
          {tab === "audit-log" && <AuditSection />}
        </main>
      </div>
    </div>
  );
}
