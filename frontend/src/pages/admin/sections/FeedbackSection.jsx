import React, { useEffect, useState } from "react";
import { ErrorState, SkeletonCard } from "../../../components/Skeleton";
import useLoad from "../../../hooks/useLoad";
import { adminFeedbackDelete, adminFeedbackList, adminFeedbackSetStatus, adminFeedbackSummary } from "../../../services/feedbackService";

const inputCls = "rounded-lg bg-noor-surface2 border border-noor-border px-3 py-2 text-sm";
const day = (iso) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const stars = (n) => (n ? `${"★".repeat(n)}${"☆".repeat(5 - n)}` : "—");
const TYPE_LABEL = { general: "General", suggestion: "Suggestion", bug: "Bug", content: "Content issue" };

function Stat({ label, value }) {
  return <div className="glass-card p-4"><p className="text-xs text-noor-textMuted">{label}</p><p className="text-2xl font-display">{value ?? "—"}</p></div>;
}

export default function FeedbackSection() {
  const [filters, setFilters] = useState({ type: "", status: "", rating: "" });
  const [page, setPage] = useState(1);
  const [msg, setMsg] = useState("");
  const summary = useLoad(() => adminFeedbackSummary(), []);
  const list = useLoad(() => adminFeedbackList({ ...filters, page }), [filters, page]);

  useEffect(() => { setMsg(""); }, [filters, page]);

  const change = (key) => (e) => { setPage(1); setFilters((f) => ({ ...f, [key]: e.target.value })); };
  const fail = (e) => setMsg(e.response?.data?.message || "Action failed.");

  async function setStatus(item, status) {
    try {
      const updated = await adminFeedbackSetStatus(item._id, status);
      list.setData((d) => ({ ...d, feedback: d.feedback.map((x) => (x._id === item._id ? { ...x, status: updated.status } : x)) }));
      summary.reload();
    } catch (e) { fail(e); }
  }
  async function remove(item) {
    if (!window.confirm("Delete this feedback permanently?")) return;
    try { await adminFeedbackDelete(item._id); list.reload(); summary.reload(); } catch (e) { fail(e); }
  }

  const s = summary.data;
  return (
    <div className="space-y-6">
      {summary.error && <ErrorState message="Unable to load the summary." onRetry={summary.reload} />}
      {s && (
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Total feedback" value={s.total} />
          <Stat label="New (unread)" value={s.unread} />
          <Stat label="Average overall" value={s.averages.overall !== null ? `${s.averages.overall} / 5` : null} />
          <Stat label="Would recommend" value={s.total ? `${s.recommend.yes || 0} yes · ${s.recommend.maybe || 0} maybe · ${s.recommend.no || 0} no` : null} />
          <Stat label="Avg. ease of use" value={s.averages.ease !== null ? `${s.averages.ease} / 5` : null} />
          <Stat label="Avg. Quran reading" value={s.averages.quran !== null ? `${s.averages.quran} / 5` : null} />
          <Stat label="Avg. audio" value={s.averages.audio !== null ? `${s.averages.audio} / 5` : null} />
        </dl>
      )}

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filters">
        <select aria-label="Type" value={filters.type} onChange={change("type")} className={inputCls}>
          <option value="">All types</option>
          {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select aria-label="Status" value={filters.status} onChange={change("status")} className={inputCls}>
          <option value="">Any status</option><option value="new">New</option><option value="reviewed">Reviewed</option>
        </select>
        <select aria-label="Overall rating" value={filters.rating} onChange={change("rating")} className={inputCls}>
          <option value="">Any rating</option>
          {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} stars</option>)}
        </select>
      </div>

      {msg && <p role="alert" className="text-sm text-red-400">{msg}</p>}
      {list.error && <ErrorState message="Unable to load feedback." onRetry={list.reload} />}
      {!list.data && !list.error && <SkeletonCard />}

      {list.data && (
        <>
          <p className="text-xs text-noor-textMuted">{list.data.total} feedback · page {list.data.page} of {Math.max(1, list.data.pages)}</p>
          <ul className="space-y-3">
            {list.data.feedback.map((f) => (
              <li key={f._id} className={`glass-card p-4 space-y-2 ${f.status === "new" ? "border-noor-gold" : ""}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm">
                    <span className="font-medium">{f.user ? f.user.name : "Deleted user"}</span>
                    <span className="text-xs text-noor-textMuted"> {f.user ? `· ${f.user.email} ` : ""}· {day(f.createdAt)}</span>
                  </p>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-noor-surface2">{TYPE_LABEL[f.type]} · {f.status}</span>
                </div>
                <p className="text-xs text-noor-textMuted" dir="ltr">
                  Overall {stars(f.ratings.overall)} · Ease {stars(f.ratings.ease)} · Quran {stars(f.ratings.quran)} · Audio {stars(f.ratings.audio)} · Recommend: {f.recommend}
                </p>
                {f.features.length > 0 && <p className="text-xs text-noor-textMuted">Uses: {f.features.join(", ")}</p>}
                {f.improve && <p className="text-sm whitespace-pre-line"><span className="text-xs text-noor-textMuted">Improve / problem: </span>{f.improve}</p>}
                {f.newFeature && <p className="text-sm whitespace-pre-line"><span className="text-xs text-noor-textMuted">New feature wanted: </span>{f.newFeature}</p>}
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setStatus(f, f.status === "new" ? "reviewed" : "new")} className="text-xs px-3 py-1 rounded-full border border-noor-border hover:bg-noor-surface2">
                    {f.status === "new" ? "Mark reviewed" : "Mark as new"}
                  </button>
                  <button onClick={() => remove(f)} className="text-xs px-3 py-1 rounded-full border border-red-800 text-red-400 hover:bg-red-900/20">Delete</button>
                </div>
              </li>
            ))}
            {list.data.feedback.length === 0 && <li className="text-sm text-noor-textMuted">No feedback yet.</li>}
          </ul>
          {list.data.pages > 1 && (
            <div className="flex items-center gap-3">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="text-sm px-3 py-1 rounded-full border border-noor-border disabled:opacity-40">Previous</button>
              <button disabled={page >= list.data.pages} onClick={() => setPage((p) => p + 1)} className="text-sm px-3 py-1 rounded-full border border-noor-border disabled:opacity-40">Next</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
