import React, { useEffect, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Trash2, FolderPlus, Pencil, FolderX } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import GlassCard from "../../components/GlassCard";
import { ErrorState, SkeletonCard } from "../../components/Skeleton";
import { useToast } from "../../components/Toast";
import { fetchSurahDetail } from "../../services/quranService";
import {
  fetchBookmarks, fetchBookmarkCollections, createCollection, renameCollection,
  deleteCollection, moveBookmark, deleteBookmark,
} from "../../services/contentService";
import { useI18n } from "../../context/I18nContext";

const ALL = "__ALL__";
const MAX_SURAHS_TO_PREVIEW = 15; // keeps the page light if you have many bookmarks

const errorText = (err, fallback) => err?.response?.data?.message || fallback;

export default function Bookmarks() {
  const { t, lang, isRTL } = useI18n();
  const colName = (n) => (n === "General" ? t("bookmarks.general") : n);
  const { user, loading: authLoading } = useAuth();
  const { toastEl, notify } = useToast();
  const [bookmarks, setBookmarks] = useState(null);
  const [collections, setCollections] = useState([]);
  const [active, setActive] = useState(ALL);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState(false);
  const [texts, setTexts] = useState({}); // "2:255" -> { ar, en }
  const loadedSurahs = useRef(new Set());

  async function load() {
    setError(false);
    try {
      const [b, c] = await Promise.all([fetchBookmarks(), fetchBookmarkCollections()]);
      setBookmarks(b);
      setCollections(c);
    } catch {
      setError(true);
    }
  }

  useEffect(() => { if (user) load(); }, [user]);

  // Load the Arabic + English text of bookmarked Ayahs (one request per Surah, cached by the backend)
  useEffect(() => {
    if (!bookmarks) return;
    const wanted = [...new Set(bookmarks.filter((b) => b.type === "AYAH").map((b) => b.surahNumber))]
      .filter((n) => !loadedSurahs.current.has(n))
      .slice(0, MAX_SURAHS_TO_PREVIEW);

    wanted.forEach((n) => {
      loadedSurahs.current.add(n);
      fetchSurahDetail(n)
        .then((surah) => {
          setTexts((prev) => {
            const next = { ...prev };
            surah.ayahs.forEach((a) => { next[`${n}:${a.numberInSurah}`] = { ar: a.arabicText, en: a.translationText }; });
            return next;
          });
        })
        .catch(() => loadedSurahs.current.delete(n));
    });
  }, [bookmarks]);

  if (authLoading) return <p className="text-center py-24 text-noor-textMuted">{t("common.loading")}</p>;
  if (!user) return <Navigate to="/login" replace />;

  async function addCollection(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      await createCollection(newName);
      setNewName("");
      notify(t("bookmarks.created"));
      load();
    } catch (err) {
      notify(errorText(err, t("bookmarks.createFail")));
    }
  }

  async function rename(name) {
    const to = window.prompt(t("bookmarks.renamePrompt"), name);
    if (!to || to.trim() === name) return;
    try {
      await renameCollection(name, to);
      if (active === name) setActive(to.trim().replace(/\s+/g, " "));
      notify(t("bookmarks.renamed"));
      load();
    } catch (err) {
      notify(errorText(err, t("bookmarks.renameFail")));
    }
  }

  async function removeCollection(name) {
    if (!window.confirm(t("bookmarks.confirmDelete", { name }))) return;
    try {
      await deleteCollection(name);
      setActive(ALL);
      notify(t("bookmarks.deleted"));
      load();
    } catch (err) {
      notify(errorText(err, t("bookmarks.deleteFail")));
    }
  }

  async function move(id, collectionName) {
    try {
      await moveBookmark(id, collectionName);
      load();
    } catch (err) {
      notify(errorText(err, t("bookmarks.moveFail")));
    }
  }

  async function remove(id) {
    try {
      await deleteBookmark(id);
      load();
    } catch {
      notify(t("bookmarks.removeFail"));
    }
  }

  const visible = (bookmarks || []).filter((b) => active === ALL || b.collectionName === active);
  const custom = active !== ALL && active !== "General";

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {toastEl}
      <p className="text-xs uppercase tracking-wide text-noor-textMuted">{t("common.mySiraj")}</p>
      <h1 className="text-3xl font-display text-noor-goldBright mb-2">{t("bookmarks.title")}</h1>
      <p className="text-noor-textMuted mb-6">{t("bookmarks.subtitle")}</p>

      {error && <ErrorState message={t("bookmarks.loadError")} onRetry={load} />}
      {!bookmarks && !error && <SkeletonCard />}

      {bookmarks && (
        <>
          <div className="flex flex-wrap gap-2 mb-4" role="tablist" aria-label={t("bookmarks.collections")}>
            <button role="tab" aria-selected={active === ALL} onClick={() => setActive(ALL)}
              className={`px-4 py-1.5 rounded-full text-sm border ${active === ALL ? "bg-noor-gold text-noor-onAccent border-noor-gold" : "bg-noor-surface2 border-noor-border"}`}>
              {t("bookmarks.all", { n: bookmarks.length })}
            </button>
            {collections.map((c) => (
              <button key={c.name} role="tab" aria-selected={active === c.name} onClick={() => setActive(c.name)}
                className={`px-4 py-1.5 rounded-full text-sm border ${active === c.name ? "bg-noor-gold text-noor-onAccent border-noor-gold" : "bg-noor-surface2 border-noor-border"}`}>
                {colName(c.name)} ({c.count})
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3 mb-8">
            <form onSubmit={addCollection} className="flex items-center gap-2">
              <label htmlFor="new-collection" className="sr-only">{t("bookmarks.newName")}</label>
              <input id="new-collection" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={40}
                placeholder={t("bookmarks.newNamePh")}
                className="rounded-lg bg-noor-surface2 border border-noor-border px-3 py-1.5 text-sm" />
              <button type="submit" className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-noor-gold text-noor-onAccent text-sm">
                <FolderPlus size={14} /> {t("bookmarks.create")}
              </button>
            </form>
            {custom && (
              <>
                <button onClick={() => rename(active)} className="flex items-center gap-1 text-xs text-noor-textMuted hover:text-noor-goldBright"><Pencil size={14} /> {t("bookmarks.rename")}</button>
                <button onClick={() => removeCollection(active)} className="flex items-center gap-1 text-xs text-noor-textMuted hover:text-red-400"><FolderX size={14} /> {t("bookmarks.deleteCollection")}</button>
              </>
            )}
          </div>

          <div className="space-y-3">
            {visible.map((b) => (
              <GlassCard key={b._id} className="!p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {b.type === "AYAH" && (
                      <>
                        <Link className="text-noor-goldBright text-sm" to={`/quran/${b.surahNumber}?ayah=${b.ayahNumber}`}>{t("bookmarks.quranRef", { s: b.surahNumber, a: b.ayahNumber })}</Link>
                        {texts[`${b.surahNumber}:${b.ayahNumber}`] && (
                          <>
                            <p dir="rtl" lang="ar" className="font-arabic text-xl text-right mt-2">{texts[`${b.surahNumber}:${b.ayahNumber}`].ar}</p>
                            {lang === "en" && <p className="text-sm text-noor-textMuted mt-2">{texts[`${b.surahNumber}:${b.ayahNumber}`].en}</p>}
                          </>
                        )}
                      </>
                    )}
                    {b.type === "SURAH" && <Link className="text-noor-goldBright text-sm" to={`/quran/${b.surahNumber}`}>{t("bookmarks.surahRef", { n: b.surahNumber })}</Link>}
                    {b.type === "HADITH" && <Link className="text-sm capitalize text-noor-goldBright" to={`/hadith/${b.hadithBook}`}>{t("bookmarks.hadithRef", { book: b.hadithBook, n: b.hadithNumber })}</Link>}
                    {b.type === "DUA" && <Link className="text-sm text-noor-goldBright" to="/duas">{t("bookmarks.duaRef", { ref: b.duaRef })}</Link>}
                  </div>
                  <button aria-label={t("bookmarks.remove")} onClick={() => remove(b._id)} className="text-noor-textMuted hover:text-red-400"><Trash2 size={16} /></button>
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-noor-textMuted">
                  <label htmlFor={`move-${b._id}`}>{t("bookmarks.collection")}</label>
                  <select id={`move-${b._id}`} value={b.collectionName} onChange={(e) => move(b._id, e.target.value)}
                    className="rounded-lg bg-noor-surface2 border border-noor-border px-2 py-1 text-xs text-noor-text">
                    {collections.map((c) => <option key={c.name} value={c.name}>{colName(c.name)}</option>)}
                  </select>
                </div>
              </GlassCard>
            ))}
            {visible.length === 0 && (
              <p className="text-noor-textMuted text-sm">
                {bookmarks.length === 0 ? t("bookmarks.noneYet") : t("bookmarks.emptyCollection")}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
