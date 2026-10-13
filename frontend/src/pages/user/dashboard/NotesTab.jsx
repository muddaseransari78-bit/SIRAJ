import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Trash2 } from "lucide-react";
import { ErrorState, SkeletonCard } from "../../../components/Skeleton";
import useLoad from "../../../hooks/useLoad";
import { fetchNotes, deleteNote } from "../../../services/contentService";
import { useI18n } from "../../../context/I18nContext";

export default function NotesTab() {
  const { t, locale } = useI18n();
  const when = (iso) => new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
  const { data, error, reload, setData } = useLoad(fetchNotes);
  const [failed, setFailed] = useState(false);

  if (error) return <ErrorState message={t("notes.loadError")} onRetry={reload} />;
  if (!data) return <SkeletonCard />;

  const remove = async (id) => {
    setFailed(false);
    try { await deleteNote(id); setData((list) => list.filter((n) => n._id !== id)); }
    catch { setFailed(true); }
  };

  return (
    <section aria-label={t("notes.aria")} className="space-y-3">
      <p className="text-sm text-noor-textMuted">{t("notes.intro")}</p>
      {failed && <p role="alert" className="text-sm text-red-400">{t("notes.deleteFail")}</p>}
      {data.length === 0 && <p className="text-sm text-noor-textMuted">{t("notes.none")}</p>}
      <ul className="space-y-2">
        {data.map((n) => (
          <li key={n._id} className="glass-card px-4 py-3 flex items-start justify-between gap-3 text-sm">
            <div className="min-w-0">
              <Link className="text-noor-goldBright text-xs" to={`/quran/${n.surahNumber}?ayah=${n.ayahNumber}`}>{t("bookmarks.quranRef", { s: n.surahNumber, a: n.ayahNumber })}</Link>
              <span className="text-xs text-noor-textMuted"> · {when(n.createdAt)}</span>
              <p className="mt-1 whitespace-pre-wrap break-words">{n.text}</p>
            </div>
            <button aria-label={t("notes.deleteNote", { ref: `${n.surahNumber}:${n.ayahNumber}` })} onClick={() => remove(n._id)} className="text-noor-textMuted hover:text-red-400"><Trash2 size={16} /></button>
          </li>
        ))}
      </ul>
    </section>
  );
}
