import React from "react";
import { heatLevel, heatmapColumns } from "../../utils/dashboard";

const LEVEL_CLASS = ["bg-noor-surface2", "bg-emerald-900", "bg-emerald-700", "bg-emerald-500", "bg-noor-goldBright"];

// GitHub-style calendar: one column per week, one square per day.
export default function Heatmap({ days, label }) {
  const columns = heatmapColumns(days);
  const active = days.filter((d) => d.count > 0).length;
  return (
    <div>
      <div role="img" aria-label={`${label}: ${active} active days out of ${days.length}`} className="flex gap-1 overflow-x-auto pb-1">
        {columns.map((col, i) => (
          <div key={i} className="flex flex-col gap-1">
            {col.map((cell, j) =>
              cell ? (
                <div key={cell.date} title={`${cell.date}: ${cell.count} action${cell.count === 1 ? "" : "s"}`}
                  className={`w-3.5 h-3.5 rounded-sm ${LEVEL_CLASS[heatLevel(cell.count)]}`} />
              ) : (
                <div key={`pad-${j}`} className="w-3.5 h-3.5" />
              )
            )}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1.5 text-[11px] text-noor-textMuted mt-2" aria-hidden="true">
        Less {LEVEL_CLASS.map((c) => <span key={c} className={`w-3 h-3 rounded-sm ${c}`} />)} More
      </div>
    </div>
  );
}
