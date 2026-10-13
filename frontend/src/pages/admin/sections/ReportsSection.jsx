import React, { useEffect, useState } from "react";
import { ErrorState, SkeletonCard } from "../../../components/Skeleton";
import { adminReport } from "../../../services/contentService";
import { addDays, localDate } from "../../../utils/date";
import { shortDay, toCsv } from "../../../utils/adminFormat";

const COLUMNS = [
  { key: "date", label: "Date" },
  { key: "signups", label: "New sign-ups" },
  { key: "activeUsers", label: "Active users" },
  { key: "readingActions", label: "Reading actions" },
  { key: "tasbeehSessions", label: "Tasbeeh sessions" },
  { key: "tasbeehCount", label: "Tasbeeh count" },
  { key: "prayersLogged", label: "Prayers logged" },
];
const inputCls = "rounded-lg bg-noor-surface2 border border-noor-border px-3 py-2 text-sm";

function download(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function ReportsSection() {
  const today = localDate();
  const [from, setFrom] = useState(localDate(addDays(new Date(), -29)));
  const [to, setTo] = useState(today);
  const [report, setReport] = useState(null);
  const [state, setState] = useState("loading"); // loading | ready | error
  const [message, setMessage] = useState("");

  const run = async () => {
    setState("loading"); setMessage("");
    try { setReport(await adminReport(from, to)); setState("ready"); }
    catch (e) {
      setState(e.response?.status === 400 ? "ready" : "error");
      setMessage(e.response?.data?.message || "");
    }
  };
  useEffect(() => { run(); /* eslint-disable-next-line */ }, []);

  const submit = (e) => { e.preventDefault(); run(); };

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-noor-textMuted block">From<input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} required className={`${inputCls} block mt-1`} /></label>
        <label className="text-xs text-noor-textMuted block">To<input type="date" value={to} max={today} onChange={(e) => setTo(e.target.value)} required className={`${inputCls} block mt-1`} /></label>
        <button className="px-4 py-2 rounded-lg bg-noor-gold text-noor-onAccent text-sm">Run report</button>
        {report && state === "ready" && !message && (
          <button type="button" onClick={() => download(`siraj-report-${report.from}-to-${report.to}.csv`, toCsv(report.rows, COLUMNS))}
            className="px-4 py-2 rounded-lg border border-noor-border text-sm">Download CSV</button>
        )}
      </form>
      <p className="text-xs text-noor-textMuted">A report can cover up to 92 days. It contains totals only — no names, emails or private content.</p>

      {message && <p role="alert" className="text-sm text-red-400">{message}</p>}
      {state === "loading" && <SkeletonCard />}
      {state === "error" && <ErrorState message="Unable to build the report. Please try again." onRetry={run} />}

      {report && state === "ready" && !message && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              ["New sign-ups", report.totals.signups],
              ["Different active users", report.totals.distinctActiveUsers],
              ["Reading actions", report.totals.readingActions],
              ["Tasbeeh sessions", `${report.totals.tasbeehSessions} (${report.totals.tasbeehCount})`],
              ["Prayers logged", report.totals.prayersLogged],
              ["New saved items", report.newBookmarks.total],
              ["New notes", report.newNotes],
            ].map(([label, value]) => (
              <div key={label} className="glass-card p-4"><p className="text-xs text-noor-textMuted">{label}</p><p className="text-2xl font-display text-noor-goldBright">{value}</p></div>
            ))}
          </div>

          <div className="glass-card p-4 overflow-x-auto max-h-[28rem] overflow-y-auto">
            <table className="w-full text-sm min-w-[560px]">
              <caption className="sr-only">Daily numbers from {report.from} to {report.to}</caption>
              <thead>
                <tr className="text-xs text-noor-textMuted text-right">
                  {COLUMNS.map((c, i) => <th key={c.key} scope="col" className={`font-normal pb-2 sticky top-0 bg-noor-surface ${i === 0 ? "text-left" : ""}`}>{c.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {report.rows.map((r) => (
                  <tr key={r.date} className="border-t border-noor-border text-right">
                    <th scope="row" className="font-normal py-1.5 text-left">{shortDay(r.date)}</th>
                    {COLUMNS.slice(1).map((c) => <td key={c.key}>{r[c.key]}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
