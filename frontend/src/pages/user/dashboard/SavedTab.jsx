import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Trash2 } from "lucide-react";
import { ErrorState, SkeletonCard } from "../../../components/Skeleton";
import useLoad from "../../../hooks/useLoad";
import { fetchBookmarks, deleteBookmark } from "../../../services/contentService";
import { bookmarkTarget, groupBookmarks } from "../../../utils/dashboard";
import { useI18n } from "../../../context/I18nContext";

const FILTERS = [
  { key: "all", label: "sf.all" },
  { key: "quran", label: "sf.quran" },
  { key: "hadith", label: "sf.hadith" },
  { key: "duas", label: "sf.duas" },
];

export default function SavedTab() {
  const { t, isRTL } = useI18n();
  const { data, error, reload, setData } = useLoad(fetchBookmarks);
  const [filter, setFilter] = useState("all");
  const [failed, setFailed] = useState(false);

  if (error) return <ErrorState message={t("saved.loadError")} onRetry={reload} />;
  if (!data) return <SkeletonCard />;

  const groups = groupBookmarks(data);
  const shown = filter === "all" ? data : groups[filter];

  const remove = async (id) => {
    setFailed(false);
    try { await deleteBookmark(id); setData((list) => list.filter((b) => b._id !== id)); }
    catch { setFailed(true); }
  };

  return (
    <section aria-label={t("saved.aria")} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2" role="group" aria-label={t("saved.filter")}>
          {FILTERS.map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)} aria-pressed={filter === f.key}
              className={`px-3 py-1.5 rounded-full text-sm border ${filter === f.key ? "bg-noor-gold text-noor-onAccent border-noor-gold" : "border-noor-border text-noor-textMuted hover:text-noor-text"}`}>
              {t(f.label)} {f.key === "all" ? data.length : groups[f.key].length}
            </button>
          ))}
        </div>
        <Link to="/bookmarks" className="text-sm text-noor-goldBright">{t("saved.manage")} {isRTL ? "←" : "→"}</Link>
      </div>

      {failed && <p role="alert" className="text-sm text-red-400">{t("saved.removeFail")}</p>}
      {shown.length === 0 && (
        <p className="text-sm text-noor-textMuted">
          {data.length === 0 ? t("saved.none") : t("saved.noneGroup")}
        </p>
      )}

      <ul className="space-y-2">
        {shown.map((b) => {
          const raw = bookmarkTarget(b);
          const target = { ...raw, label: b.type === "AYAH" ? t("bookmarks.quranRef", { s: b.surahNumber, a: b.ayahNumber }) : b.type === "SURAH" ? t("common.surahN", { n: b.surahNumber }) : b.type === "DUA" ? t("saved.dua", { ref: b.duaRef }) : raw.label };
          return (
            <li key={b._id} className="glass-card px-4 py-3 flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0">
                <Link to={target.to} className="text-noor-goldBright capitalize">{target.label}</Link>
                <p className="text-xs text-noor-textMuted">{t(`saved.type.${b.type}`)} · {b.collectionName && b.collectionName !== "General" ? b.collectionName : t("bookmarks.general")}</p>
              </div>
              <button aria-label={t("saved.removeItem", { label: target.label })} onClick={() => remove(b._id)} className="text-noor-textMuted hover:text-red-400"><Trash2 size={16} /></button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
