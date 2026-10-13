import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Bookmark, StickyNote, Play, Copy, Share2 } from "lucide-react";
import { ARABIC_FONTS } from "../hooks/useReadingSettings";
import { useI18n } from "../context/I18nContext";
import { parseTajweed } from "../utils/tajweed";

/**
 * One Ayah with all its layers and actions.
 * Props:
 *  ayah                - object from the SIRAJ API
 *  settings            - reading settings (font size, toggles...)
 *  highlighted         - true while this ayah is being recited
 *  onPlay              - optional; when missing the Play button is hidden
 *  onBookmark, onMarkRead, onSaveNote(ayah, text) - handlers from the page
 *  notify(text)        - toast function
 *  showSurahLabel      - show "Surah name 2:255" (used on Juz/Page views)
 *  tajweedText         - optional Tajweed-marked text of this Ayah (shown when the Tajweed setting is on)
 *  noAnchor            - do not set the scroll id (the Mushaf text already owns "ayah-<surah>-<ayah>")
 */
export default function AyahCard({
  ayah, settings, highlighted, onPlay, onBookmark, onMarkRead, onSaveNote, notify, showSurahLabel, tajweedText, noAnchor,
}) {
  const { t } = useI18n();
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const font = ARABIC_FONTS.find((f) => f.id === settings.arabicFont) || ARABIC_FONTS[0];
  const ref = `Quran ${ayah.surahNumber}:${ayah.numberInSurah}`;

  function buildShareText() {
    const parts = [ayah.arabicText];
    if (settings.showEnglish && ayah.translationText) parts.push(ayah.translationText);
    if (settings.showUrdu && ayah.urduText) parts.push(ayah.urduText);
    parts.push(`— ${ref} (via SIRAJ)`);
    return parts.join("\n\n");
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(buildShareText());
      notify?.(t("ayah.copied"));
    } catch {
      notify?.(t("ayah.copyUnavailable"));
    }
  }

  async function share() {
    const text = buildShareText();
    if (navigator.share) {
      try { await navigator.share({ title: ref, text }); } catch { /* user cancelled */ }
    } else {
      copy();
    }
  }

  async function submitNote() {
    if (!noteText.trim()) return;
    const ok = await onSaveNote(ayah, noteText.trim());
    if (ok) { setNoteText(""); setNoteOpen(false); }
  }

  const btn = "flex items-center gap-1 text-xs text-noor-textMuted hover:text-noor-goldBright";

  return (
    <div
      id={noAnchor ? undefined : `ayah-${ayah.surahNumber}-${ayah.numberInSurah}`}
      className={`border-b border-noor-border pb-6 rounded-lg transition-[background-color,box-shadow] duration-300 ${highlighted ? "ayah-active" : ""}`}
    >
      {showSurahLabel && (
        <Link to={`/quran/${ayah.surahNumber}`} className="text-xs text-noor-goldBright mb-2 inline-block">
          {ayah.surahEnglishName} · {ayah.surahNumber}:{ayah.numberInSurah}
        </Link>
      )}

      <div className="flex items-start justify-between gap-4">
        <span className="flex-shrink-0 w-8 h-8 rounded-full bg-noor-surface2 text-noor-goldBright text-xs flex items-center justify-center mt-1">
          {ayah.numberInSurah}
        </span>
        <p dir="rtl" lang="ar" className="font-arabic text-right flex-1" style={{ fontSize: `${settings.fontSize}px`, fontFamily: font.css }}>
          {settings.showTajweed && tajweedText
            ? parseTajweed(tajweedText).map((p, i) => (p.rule ? <span key={i} className={p.rule.cls} title={p.rule.name}>{p.text}</span> : <React.Fragment key={i}>{p.text}</React.Fragment>))
            : ayah.arabicText}
        </p>
      </div>

      {/* ps-11 = padding on the same side as the number badge, so it works in LTR and RTL */}
      <div className="ps-11">
        {settings.showTransliteration && ayah.transliterationText && (
          <p dir="ltr" lang="en" className="italic text-noor-textMuted mt-3 text-start">{ayah.transliterationText}</p>
        )}
        {settings.showEnglish && ayah.translationText && (
          <p dir="ltr" lang="en" className="text-noor-textMuted mt-3 text-start">{ayah.translationText}</p>
        )}
        {settings.showUrdu && ayah.urduText && (
          <p dir="rtl" lang="ur" className="font-urdu text-noor-textMuted mt-3 text-right" style={{ fontSize: `${Math.max(16, settings.fontSize - 6)}px` }}>
            {ayah.urduText}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3">
          {onPlay && <button onClick={() => onPlay(ayah)} className={btn}><Play size={14} /> {t("ayah.play")}</button>}
          <button onClick={() => onBookmark(ayah)} className={btn}><Bookmark size={14} /> {t("ayah.bookmark")}</button>
          <button onClick={copy} className={btn}><Copy size={14} /> {t("ayah.copy")}</button>
          <button onClick={share} className={btn}><Share2 size={14} /> {t("ayah.share")}</button>
          <button onClick={() => onMarkRead(ayah)} className={btn}>📍 {t("ayah.markRead")}</button>
          <Link to={`/tafseer/${ayah.surahNumber}/${ayah.numberInSurah}`} className={btn}>📖 {t("ayah.tafseer")}</Link>
          <button onClick={() => setNoteOpen((v) => !v)} className={btn}><StickyNote size={14} /> {t("ayah.note")}</button>
        </div>

        {noteOpen && (
          <div className="mt-3 flex gap-2">
            <input
              type="text" value={noteText} onChange={(e) => setNoteText(e.target.value)}
              placeholder={t("ayah.notePlaceholder")} aria-label={t("ayah.noteAria")}
              className="flex-1 rounded-lg bg-noor-surface2 border border-noor-border px-3 py-1.5 text-sm"
            />
            <button onClick={submitNote} className="px-3 py-1.5 rounded-lg bg-noor-gold text-noor-onAccent text-sm">{t("ayah.save")}</button>
          </div>
        )}
      </div>
    </div>
  );
}
