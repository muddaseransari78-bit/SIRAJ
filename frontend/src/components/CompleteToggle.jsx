import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import { fetchProgress, setCompleted } from "../services/contentService";

/**
 * "Mark this Surah / Juz as completed" button used at the end of the readers.
 * Props: type ("surah" | "juz"), number, notify(text)
 */
export default function CompleteToggle({ type, number, notify }) {
  const { user } = useAuth();
  const { t } = useI18n();
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  // Is it already completed? (only for logged-in users)
  useEffect(() => {
    setDone(false);
    if (!user) return;
    let cancelled = false;
    fetchProgress()
      .then((p) => {
        const list = (type === "surah" ? p.surahsCompleted : p.juzCompleted) || [];
        if (!cancelled) setDone(list.includes(number));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user, type, number]);

  async function toggle() {
    if (!user) return notify(t("toast.loginComplete"));
    setBusy(true);
    try {
      await setCompleted(type, number, !done);
      setDone(!done);
      notify(!done ? t("toast.completeSaved") : t("toast.completeRemoved"));
    } catch {
      notify(t("toast.completeFail"));
    } finally {
      setBusy(false);
    }
  }

  const label =
    type === "surah"
      ? done ? t("reader.surahCompleted") : t("reader.markSurahComplete")
      : done ? t("reader.juzCompleted") : t("reader.markJuzComplete");

  return (
    <div className="flex justify-center mt-10">
      <button
        onClick={toggle}
        disabled={busy}
        aria-pressed={done}
        className={`px-6 py-3 rounded-full text-sm font-medium border disabled:opacity-60 ${
          done ? "bg-emerald-900/40 border-noor-emeraldBright text-noor-text" : "bg-noor-gold text-noor-onAccent border-noor-gold hover:bg-noor-goldBright"
        }`}
      >
        {label}
      </button>
    </div>
  );
}
