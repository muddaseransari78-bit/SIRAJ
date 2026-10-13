import React from "react";
import { Check, AlertTriangle, X } from "lucide-react";
import GlassCard from "./GlassCard";
import { describeDiffT, summaryLineT } from "../utils/harakatLabels";
import { useI18n } from "../context/I18nContext";

// Same idea as the word colours on the Live Recitation page: icon + text, never colour alone.
const STYLE = {
  ok: "border-emerald-500/60 bg-emerald-500/10",
  harakat: "border-red-400/60 bg-red-400/10",
  unclear: "border-amber-400/60 bg-amber-400/10",
  notheard: "border-noor-border opacity-60",
  neutral: "border-transparent",
};
const LABEL_KEY = { ok: "hr.ok", harakat: "hr.harakat", unclear: "hr.unclear", notheard: "hr.notheard" };

function Icon({ status }) {
  if (status === "ok") return <Check size={14} className="text-emerald-400" aria-hidden="true" />;
  if (status === "harakat") return <X size={14} className="text-red-400" aria-hidden="true" />;
  if (status === "unclear") return <AlertTriangle size={14} className="text-amber-300" aria-hidden="true" />;
  return null;
}

/** One Ayah's result of the zabar/zer/pesh check. entry = { state: "loading" | "error" | "done", result?, message? } */
export default function HarakatResult({ ayahNumber, entry }) {
  const { t } = useI18n();
  if (!entry) return null;

  if (entry.state === "loading") {
    return <p role="status" className="text-sm text-noor-textMuted py-2">{t("hr.checking", { n: ayahNumber })}</p>;
  }
  if (entry.state === "error") {
    return <p role="alert" className="text-sm text-red-400 py-2">{t("hr.errorLine", { n: ayahNumber, message: entry.message })}</p>;
  }

  const r = entry.result;
  const wrongWords = r?.available ? r.words.filter((w) => w.status === "harakat") : [];

  return (
    <div className="border-b border-noor-border/50 py-3">
      <p className="text-sm mb-2"><strong>{t("common.ayahN", { n: ayahNumber })}</strong> — <span className={r?.available ? "" : "text-amber-300"}>{summaryLineT(t, r)}</span></p>

      {r?.available && (
        <>
          <div dir="rtl" lang="ar" className="flex flex-wrap gap-2 mb-2">
            {r.words.map((w, i) => (
              <span key={i} className={`font-arabic text-2xl leading-loose px-2 py-0.5 rounded-lg border ${STYLE[w.status] || ""}`}>
                {w.word}
                {LABEL_KEY[w.status] && <span className="sr-only"> — {t(LABEL_KEY[w.status])}</span>}
                <span className="inline-block align-middle mx-1"><Icon status={w.status} /></span>
              </span>
            ))}
          </div>

          {wrongWords.length > 0 && (
            <ul className="space-y-1 text-sm mb-2">
              {wrongWords.map((w, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2">
                  <span dir="rtl" lang="ar" className="font-arabic text-xl">{w.word}</span>
                  <span className="text-noor-textMuted">— {w.diffs.map((d) => describeDiffT(t, d)).join("; ")}</span>
                </li>
              ))}
            </ul>
          )}
          {r.summary.unclear > 0 && (
            <p className="text-xs text-noor-textMuted mb-2">{t(r.summary.unclear === 1 ? "hr.unclear1" : "hr.unclearN", { n: r.summary.unclear })}</p>
          )}
        </>
      )}

      {r?.heardText && (
        <p className="text-xs text-noor-textMuted">{t("hr.modelHeard")} <span dir="rtl" lang="ar" className="font-arabic text-base text-noor-text">{r.heardText}</span></p>
      )}
    </div>
  );
}

export function HarakatResultsCard({ results }) {
  const { t } = useI18n();
  const ayahs = Object.keys(results).map(Number).sort((a, b) => a - b);
  if (ayahs.length === 0) return null;
  return (
    <GlassCard className="mb-6">
      <h2 className="text-lg mb-1">{t("hr.cardTitle")}</h2>
      <p className="text-xs text-noor-textMuted mb-2">{t("hr.cardNote")}</p>
      {ayahs.map((n) => <HarakatResult key={n} ayahNumber={n} entry={results[n]} />)}
    </GlassCard>
  );
}
