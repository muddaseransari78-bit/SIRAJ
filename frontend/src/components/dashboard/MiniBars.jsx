import React from "react";

const weekday = (dateStr) => new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });

// Small bar chart for a [{ date, count }] list (usually the last 7 days).
// `maxValue` fixes the full height (e.g. 5 prayers); otherwise the biggest bar is full height.
export default function MiniBars({ days, maxValue, label, color = "bg-noor-emeraldBright" }) {
  const top = maxValue || Math.max(1, ...days.map((d) => d.count));
  const summary = days.map((d) => `${weekday(d.date)} ${d.count}`).join(", ");
  return (
    <div role="img" aria-label={`${label}: ${summary}`} className="flex items-end gap-1.5 h-20">
      {days.map((d) => (
        <div key={d.date} className="flex-1 flex flex-col items-center justify-end gap-1 h-full" title={`${d.date}: ${d.count}`}>
          <div className="w-full flex-1 flex items-end">
            <div
              className={`w-full rounded-t ${d.count > 0 ? color : "bg-noor-surface2"}`}
              style={{ height: `${d.count > 0 ? Math.max(8, (d.count / top) * 100) : 6}%` }}
            />
          </div>
          <span aria-hidden="true" className="text-[10px] text-noor-textMuted">{weekday(d.date).slice(0, 2)}</span>
        </div>
      ))}
    </div>
  );
}
