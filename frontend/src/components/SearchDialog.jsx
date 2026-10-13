import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, BookOpen, Hash, ScrollText, FileText, Tag, Sparkles, Clock, CornerDownLeft } from "lucide-react";
import { useI18n } from "../context/I18nContext";
import useDebouncedValue from "../hooks/useDebouncedValue";
import { searchSuggest } from "../services/contentService";
import { loadRecent, rememberSearch, clearRecent } from "../utils/recentSearches";

const ICONS = { reference: Hash, surah: BookOpen, hadith: ScrollText, page: FileText, topic: Tag, dua: Sparkles, recent: Clock, all: Search };
const LIST_ID = "siraj-search-list";

// Quick-search box opened from the navbar (button, Ctrl/Cmd+K, or "/").
// Shows fast suggestions (Surahs, Hadith collections, pages, topics, Duas, "2:255" jumps).
// Pressing Enter with nothing highlighted opens the full results page.
export default function SearchDialog({ open, onClose }) {
  const { t, isRTL } = useI18n();
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const panelRef = useRef(null);
  const [value, setValue] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [active, setActive] = useState(-1);
  const [recent, setRecent] = useState([]);
  const trimmed = value.trim();
  const debounced = useDebouncedValue(trimmed, 200);

  // On open: fresh box, remember where focus was, stop the page behind from scrolling.
  useEffect(() => {
    if (!open) return undefined;
    const before = document.activeElement;
    setValue(""); setItems([]); setActive(-1); setError(false); setRecent(loadRecent());
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    inputRef.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      if (before && typeof before.focus === "function") before.focus();
    };
  }, [open]);

  // Fetch suggestions for what was typed (older requests are cancelled).
  useEffect(() => {
    if (!open) return undefined;
    if (debounced.length < 1) { setItems([]); setLoading(false); setError(false); return undefined; }
    const ctrl = new AbortController();
    setLoading(true); setError(false);
    searchSuggest(debounced, ctrl.signal)
      .then((list) => { setItems(list); setActive(-1); })
      .catch((e) => { if (e?.code === "ERR_CANCELED") return; setItems([]); setError(true); })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
    return () => ctrl.abort();
  }, [debounced, open]);

  const rows = trimmed
    ? [
        ...items,
        ...(trimmed.length >= 2 ? [{ type: "all", label: t("search.all", { q: trimmed }), to: `/search?q=${encodeURIComponent(trimmed)}`, remember: trimmed }] : []),
      ]
    : recent.map((q) => ({ type: "recent", label: q, to: `/search?q=${encodeURIComponent(q)}`, remember: q }));

  useEffect(() => {
    if (active >= 0) document.getElementById(`siraj-search-opt-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function go(row) {
    if (row.remember) rememberSearch(row.remember);
    onClose();
    navigate(row.to);
  }

  function onKeyDown(e) {
    if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!rows.length) return;
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (i === -1 ? (step === 1 ? 0 : rows.length - 1) : (i + step + rows.length) % rows.length));
      return;
    }
    if (e.key === "Enter" && e.target === inputRef.current) {
      e.preventDefault();
      if (active >= 0 && rows[active]) go(rows[active]);
      else if (trimmed.length >= 2) go({ to: `/search?q=${encodeURIComponent(trimmed)}`, remember: trimmed });
      return;
    }
    if (e.key === "Tab" && panelRef.current) {
      // keep keyboard focus inside the dialog
      const focusable = panelRef.current.querySelectorAll("input, button:not([disabled])");
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" onKeyDown={onKeyDown}>
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("nav.search")}
        className="relative mx-auto mt-[8vh] w-[calc(100%-1.5rem)] max-w-xl bg-noor-surface border border-noor-border rounded-2xl shadow-glow overflow-hidden"
      >
        <div className="flex items-center gap-2 px-4 border-b border-noor-border">
          <Search size={18} className="text-noor-textMuted shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            role="combobox"
            aria-expanded={rows.length > 0}
            aria-controls={LIST_ID}
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 ? `siraj-search-opt-${active}` : undefined}
            aria-label={t("nav.search")}
            placeholder={t("search.placeholder")}
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
            dir="auto"
            maxLength={100}
            className="flex-1 bg-transparent py-4 outline-none placeholder:text-noor-textMuted"
          />
          <button type="button" onClick={onClose} aria-label={t("search.close")} className="p-2 rounded-full hover:bg-noor-surface2">
            <X size={18} />
          </button>
        </div>

        <p className="sr-only" role="status" aria-live="polite">
          {trimmed && !loading && !error ? t("search.count", { n: items.length }) : ""}
        </p>

        <div className="max-h-[60vh] overflow-y-auto">
          {!trimmed && recent.length > 0 && (
            <div className="flex items-center justify-between px-4 pt-3 text-xs text-noor-textMuted">
              <span>{t("search.recent")}</span>
              <button type="button" onClick={() => { setRecent(clearRecent()); }} className="hover:text-noor-goldBright">{t("search.clearRecent")}</button>
            </div>
          )}
          {!trimmed && recent.length === 0 && <p className="px-4 py-6 text-sm text-noor-textMuted">{t("search.typeMore")}</p>}
          {trimmed && !loading && error && <p className="px-4 pt-4 text-sm text-noor-textMuted">{t("search.loadError")}</p>}
          {trimmed && !loading && !error && items.length === 0 && <p className="px-4 pt-4 text-sm text-noor-textMuted">{t("search.noSuggestions")}</p>}

          <ul id={LIST_ID} role="listbox" aria-label={t("nav.search")} className="p-2">
            {rows.map((row, i) => {
              const Icon = ICONS[row.type] || Search;
              const isActive = i === active;
              return (
                <li
                  key={`${row.type}-${row.to}-${i}`}
                  id={`siraj-search-opt-${i}`}
                  role="option"
                  aria-selected={isActive}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(row)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer ${isActive ? "bg-noor-surface2 ring-1 ring-noor-gold" : ""}`}
                >
                  <Icon size={16} className="text-noor-goldBright shrink-0" aria-hidden="true" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm truncate">{row.label}</span>
                    {row.sub && <span className="block text-xs text-noor-textMuted truncate">{row.sub}</span>}
                  </span>
                  {row.arabic && <span lang="ar" dir="rtl" className="font-arabic text-noor-goldBright shrink-0">{row.arabic.replace(/^سُورَةُ\s*/, "")}</span>}
                  {isActive && <CornerDownLeft size={14} className={`text-noor-textMuted shrink-0 ${isRTL ? "scale-x-[-1]" : ""}`} aria-hidden="true" />}
                </li>
              );
            })}
          </ul>
        </div>

        <p className="hidden sm:block px-4 py-2 text-xs text-noor-textMuted border-t border-noor-border">{t("search.hint")}</p>
      </div>
    </div>
  );
}
