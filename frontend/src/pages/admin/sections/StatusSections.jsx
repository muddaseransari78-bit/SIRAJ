import React from "react";
import { ErrorState, SkeletonCard } from "../../../components/Skeleton";
import useLoad from "../../../hooks/useLoad";
import { adminSystem, adminApiStatus } from "../../../services/contentService";
import { formatUptime } from "../../../utils/adminFormat";

function Row({ name, ok, extra, note }) {
  return (
    <div className="glass-card px-4 py-3 flex flex-wrap justify-between gap-2 text-sm">
      <span>{name}{note && <span className="block text-xs text-noor-textMuted">{note}</span>}</span>
      <span className={ok ? "text-noor-emeraldBright" : "text-red-400"}>{ok ? "● Online" : "● Problem"} {extra}</span>
    </div>
  );
}

function Num({ label, value, unit }) {
  return <div className="glass-card p-4"><p className="text-xs text-noor-textMuted">{label}</p><p className="text-2xl font-display text-noor-goldBright">{value}<span className="text-sm text-noor-textMuted"> {unit}</span></p></div>;
}

export function SystemStatus() {
  const { data: s, error, reload } = useLoad(adminSystem);
  if (error) return <ErrorState message="Unable to load the system status. Please try again." onRetry={reload} />;
  if (!s) return <SkeletonCard />;
  const p = s.performance;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Row name="Backend API" ok={s.backend.ok} extra={`(up ${formatUptime(s.backend.uptimeSeconds)}, ${s.backend.env}, Node ${s.backend.node})`} />
        <Row name="Database (MongoDB)" ok={s.database.ok} extra={`(${s.database.state})`} />
        <Row name="Notifications — in-app (bell)" ok={s.notifications.inApp.ok} extra={`(${s.notifications.inApp.last24h} created in 24 hours)`} />
        <div className="glass-card px-4 py-3 text-sm space-y-1">
          <p>Browser prayer reminders: <span className="text-noor-textMuted">{s.notifications.browserReminders}</span></p>
          <p>Web Push: <span className="text-noor-textMuted">{s.notifications.webPush}</span></p>
        </div>
      </div>

      <div>
        <h2 className="text-lg mb-2">Performance</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Num label={`Average response (last ${p.windowRequests})`} value={p.avgMs} unit="ms" />
          <Num label="Slowest 5% of requests" value={p.p95Ms} unit="ms or more" />
          <Num label="Server error rate" value={p.errorRatePercent} unit="%" />
          <Num label="Requests since start" value={p.totalSinceStart} unit="" />
          <Num label="Memory in use" value={p.memoryMB} unit="MB" />
          <Num label="Errors (24 hours)" value={s.errors24h} unit="" />
          <Num label="Cache items" value={s.cache.keys} unit="" />
          <Num label="Cache hits / misses" value={`${s.cache.hits} / ${s.cache.misses}`} unit="" />
        </div>
        <p className="text-xs text-noor-textMuted mt-2">These numbers cover the most recent requests and start again from zero when the server restarts. They are a quick health hint, not full monitoring.</p>
      </div>
      <button onClick={reload} className="px-4 py-2 rounded-full border border-noor-border text-sm">Refresh</button>
    </div>
  );
}

export function ApiStatus() {
  const { data, error, reload } = useLoad(adminApiStatus);
  if (error) return <ErrorState message="Unable to run the checks. Please try again." onRetry={reload} />;
  if (!data) return <div role="status"><p className="text-sm text-noor-textMuted mb-2">Checking the external services… this can take up to 8 seconds.</p><SkeletonCard /></div>;

  return (
    <div className="space-y-3">
      {data.services.map((s) => (
        <Row key={s.name} name={s.name} note={s.group} ok={s.ok} extra={`(${s.ms} ms${s.status ? `, HTTP ${s.status}` : ""})`} />
      ))}
      {data.notConfigured.map((n) => (
        <div key={n} className="glass-card px-4 py-3 text-sm text-noor-textMuted">○ Not set up: {n}</div>
      ))}
      <p className="text-xs text-noor-textMuted">Checked {new Date(data.checkedAt).toLocaleTimeString()}. Only the address of each service is used; no keys or secrets are shown.</p>
      <button onClick={reload} className="px-4 py-2 rounded-full border border-noor-border text-sm">Re-check</button>
    </div>
  );
}
