import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Copy, Check, RefreshCw, HandHeart } from "lucide-react";
import GlassCard from "./GlassCard";
import { useI18n } from "../context/I18nContext";
import { duaForDate, duaShareText } from "../utils/dailyDua";

// "Dua of the Day": Arabic + translation + source. Changes at midnight. "Another dua" shows the next one.
export default function DailyDua({ className = "" }) {
  const { t, lang } = useI18n();
  const [shift, setShift] = useState(0);
  const [copied, setCopied] = useState(false);
  const dua = duaForDate(new Date(), shift);
  const urdu = lang === "ur";

  async function copy() {
    const text = duaShareText(dua, lang);
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      // older browsers / blocked clipboard: select-and-copy fallback
      const box = document.createElement("textarea");
      box.value = text;
      box.setAttribute("readonly", "");
      box.style.position = "fixed";
      box.style.opacity = "0";
      document.body.appendChild(box);
      box.select();
      try { document.execCommand("copy"); } catch (err) { /* nothing more we can do */ }
      document.body.removeChild(box);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <GlassCard className={`border-noor-gold/40 ${className}`}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="flex items-center gap-2 text-sm uppercase tracking-wide text-noor-textMuted font-body">
          <HandHeart size={16} className="text-noor-goldBright" aria-hidden="true" /> {t("dua.daily.title")}
        </h2>
        <Link to="/duas" className="text-xs text-noor-goldBright hover:underline">{t("dua.daily.all")}</Link>
      </div>

      <p dir="rtl" lang="ar" className="font-arabic text-2xl sm:text-3xl leading-[2.1] text-center sm:text-right text-noor-text">{dua.ar}</p>
      <p
        dir={urdu ? "rtl" : "ltr"}
        lang={urdu ? "ur" : "en"}
        className={`mt-4 text-noor-textMuted leading-relaxed ${urdu ? "font-urdu text-lg text-right" : "text-sm sm:text-base"}`}
      >
        {urdu ? dua.ur : dua.en}
      </p>
      <p className="text-xs text-noor-goldBright mt-3" dir="ltr">{dua.ref}</p>

      <div className="flex flex-wrap gap-2 mt-4">
        <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-noor-border text-xs hover:bg-noor-surface2">
          {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
          <span role="status">{copied ? t("dua.daily.copied") : t("dua.daily.copy")}</span>
        </button>
        <button type="button" onClick={() => setShift((n) => n + 1)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-noor-border text-xs hover:bg-noor-surface2">
          <RefreshCw size={14} aria-hidden="true" /> {t("dua.daily.next")}
        </button>
      </div>
    </GlassCard>
  );
}
