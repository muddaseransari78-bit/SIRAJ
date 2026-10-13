import React from "react";
import { ErrorState, SkeletonCard } from "../../../components/Skeleton";
import useLoad from "../../../hooks/useLoad";
import { adminAuditLog } from "../../../services/contentService";
import { actionLabel } from "../../../utils/adminFormat";

export default function AuditSection() {
  const { data, error, reload } = useLoad(adminAuditLog);
  if (error) return <ErrorState message="Unable to load the audit log. Please try again." onRetry={reload} />;
  if (!data) return <SkeletonCard />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-noor-textMuted">Who changed what in the admin portal. The latest 100 actions are shown; entries are deleted after one year. No passwords or message texts are stored here.</p>
        <button onClick={reload} className="text-xs px-3 py-1 rounded-full border border-noor-border shrink-0">Refresh</button>
      </div>
      {data.length === 0 && <p className="text-sm text-noor-textMuted">No admin actions recorded yet.</p>}
      <ul className="space-y-2">
        {data.map((l) => (
          <li key={l._id} className="glass-card px-4 py-3 text-sm">
            <p><span className="text-noor-goldBright">{actionLabel(l.action)}</span>{l.target ? <span> — {l.target}</span> : null}</p>
            {l.detail && <p className="text-noor-textMuted break-words">{l.detail}</p>}
            <p className="text-xs text-noor-textMuted">by {l.actorName || "admin"} ({l.actorRole}) · {new Date(l.createdAt).toLocaleString()}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
