import React, { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Send } from "lucide-react";
import GlassCard from "../../components/GlassCard";
import HadithCard from "../hadith/HadithCard";
import { askAssistant } from "../../services/contentService";
import AyahSnippet from "../../components/AyahSnippet";
import { resultSurahName } from "../../utils/ayahLayers";
import { useI18n } from "../../context/I18nContext";

// Example questions in the reader's own language (Arabic / Urdu words are searched in the Arabic / Urdu text)
const EXAMPLES = {
  en: ["2:255", "Ayat al-Kursi", "surah Yasin", "patience", "when is iftar", "forgiveness dua"],
  ur: ["2:255", "آیت الکرسی", "سورہ یٰسین", "صبر", "افطار", "مغفرت کی دعا"],
  ar: ["2:255", "آية الكرسي", "سورة يس", "الصبر", "الإفطار", "دعاء المغفرة"],
};
// Names of SIRAJ pages come from the server in English: show them in the reader's language
const NAV_KEYS = {
  "/prayer": "nav.prayer", "/qibla": "nav.qibla", "/tasbeeh": "nav.tasbeeh", "/calendar": "nav.calendar", "/ramadan": "nav.ramadan",
  "/recitation": "nav.recite", "/recitation/live": "nav.recite", "/bookmarks": "bookmarks.title", "/progress": "progress.title",
  "/goals": "goals.title", "/profile": "nav.profile", "/topics": "nav.topics",
};

function Answer({ a }) {
  const { t, lang, isRTL } = useI18n();
  const navLabel = (n) => (NAV_KEYS[n.to] ? t(NAV_KEYS[n.to]) : n.label);
  const nothing = !a.reference && !a.surah && a.navigation.length === 0 && a.quran.length === 0 && a.hadith.length === 0 && a.duas.length === 0;
  return (
    <div className="space-y-3">
      {a.reference && (
        <GlassCard><p className="text-sm">{t("assistant.openAyah")} <Link className="text-noor-goldBright" to={`/quran/${a.reference.surahNumber}?ayah=${a.reference.ayahNumber}`}>{t("bookmarks.quranRef", { s: a.reference.surahNumber, a: a.reference.ayahNumber })}</Link> · <Link className="text-noor-goldBright" to={`/tafseer/${a.reference.surahNumber}/${a.reference.ayahNumber}`}>{t("assistant.itsTafseer")}</Link></p></GlassCard>
      )}
      {a.surah && (
        <GlassCard><p className="text-sm">{t("assistant.openSurah")} <Link className="text-noor-goldBright" to={`/quran/${a.surah.number}`}>{lang !== "en" && a.surah.name ? `${a.surah.number}. ${a.surah.name}` : a.surah.englishName ? `${a.surah.number}. ${a.surah.englishName}` : t("common.surahN", { n: a.surah.number })}</Link></p></GlassCard>
      )}
      {a.navigation.length > 0 && (
        <GlassCard>
          <p className="text-xs text-noor-textMuted mb-2">{t("assistant.pages")}</p>
          <div className="flex flex-wrap gap-2">{a.navigation.map((n) => <Link key={n.to} to={n.to} className="px-4 py-2 rounded-full border border-noor-gold text-noor-goldBright text-sm">{navLabel(n)}</Link>)}</div>
        </GlassCard>
      )}
      {a.quran.length > 0 && (
        <div>
          <h2 className="text-lg mb-2">{t("sf.quran")}</h2>
          <div className="space-y-2">{a.quran.map((r, i) => (
            <Link key={i} to={`/quran/${r.surahNumber}?ayah=${r.ayahNumber}`} className="block glass-card p-4 hover:shadow-emeraldGlow">
              <p className="text-xs text-noor-goldBright">{resultSurahName(r, lang)} {r.surahNumber}:{r.ayahNumber}</p>
              <AyahSnippet r={r} lang={lang} />
            </Link>))}</div>
        </div>
      )}
      {a.hadith.length > 0 && (
        <div><h2 className="text-lg mb-2">{t("sf.hadith")}</h2><div className="space-y-3">{a.hadith.map((h, i) => <HadithCard key={i} hadith={h} />)}</div></div>
      )}
      {a.duas.length > 0 && (
        <div>
          <h2 className="text-lg mb-2">{t("sf.duas")}</h2>
          <div className="space-y-2">{a.duas.map((d, i) => (
            <Link key={i} to={`/duas/${d.category}`} className="block glass-card p-4 hover:shadow-emeraldGlow">
              <p className="text-xs text-noor-goldBright capitalize">{(t(`duas.cat.${d.category}`) !== `duas.cat.${d.category}` ? t(`duas.cat.${d.category}`) : d.category.replace(/-/g, " "))}{d.source ? ` · ${d.source}` : ""}</p>
              {lang !== "en" && d.ar && <p dir="rtl" lang="ar" className="font-arabic text-lg text-right mt-1">{d.ar}</p>}
              {lang === "ur" && d.ur && <p dir="rtl" lang="ur" className="font-urdu text-noor-textMuted text-base text-right mt-1">{d.ur}</p>}
              {(lang === "en" || (lang === "ur" && !d.ur) || (lang === "ar" && !d.ar)) && d.en && <p dir="ltr" lang="en" className="text-noor-textMuted text-sm mt-1">{d.en}</p>}
            </Link>))}</div>
        </div>
      )}
      {(a.errors.quran || a.errors.hadith || a.errors.duas) && <p className="text-xs text-amber-400">{t("assistant.partial")}</p>}
      {nothing && <GlassCard><p className="text-noor-textMuted text-sm">{t("assistant.nothing")}</p></GlassCard>}
      <p className="text-xs text-noor-textMuted">
        <Link to={`/search?q=${encodeURIComponent(a.query)}`} className="text-noor-goldBright">{t("assistant.seeAll", { q: a.query })} {isRTL ? "←" : "→"}</Link>
      </p>
    </div>
  );
}

export default function Assistant() {
  const { t: tr, lang } = useI18n();
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState([]); // [{ q, answer?, error?, loading }]
  const busy = useRef(false);

  async function ask(text) {
    const q = text.trim();
    if (q.length < 2 || busy.current) return;
    busy.current = true;
    setInput("");
    setTurns((t) => [{ q, loading: true }, ...t]);
    try {
      const answer = await askAssistant(q, lang);
      setTurns((t) => t.map((x, i) => (i === 0 ? { q, answer } : x)));
    } catch (e) {
      setTurns((t) => t.map((x, i) => (i === 0 ? { q, error: e.response?.data?.message || tr("assistant.error") } : x)));
    } finally { busy.current = false; }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-display text-noor-goldBright mb-2">{tr("footer.assistant")}</h1>
      <p className="text-noor-textMuted mb-4">{tr("assistant.subtitle")}</p>
      <p role="note" className="text-xs text-noor-textMuted glass-card p-3 mb-6">
        {tr("assistant.note")}
      </p>

      <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="flex gap-2 mb-3">
        <label htmlFor="assistant-q" className="sr-only">{tr("assistant.yourQuestion")}</label>
        <input id="assistant-q" value={input} onChange={(e) => setInput(e.target.value)} maxLength={100} placeholder={tr("assistant.placeholder")}
          className="flex-1 rounded-lg bg-noor-surface2 border border-noor-border px-4 py-3" />
        <button aria-label={tr("assistant.send")} className="px-5 rounded-lg bg-noor-gold text-noor-onAccent"><Send size={18} aria-hidden="true" /></button>
      </form>
      <div className="flex flex-wrap gap-2 mb-8">
        {(EXAMPLES[lang] || EXAMPLES.en).map((ex) => <button key={ex} onClick={() => ask(ex)} className="px-3 py-1 rounded-full text-xs bg-noor-surface2 border border-noor-border">{ex}</button>)}
      </div>

      <div className="space-y-8" aria-live="polite">
        {turns.map((t, i) => (
          <section key={`${i}-${t.q}`}>
            <p className="text-sm text-noor-textMuted mb-2">{tr("assistant.youAsked")} <strong className="text-noor-text">{t.q}</strong></p>
            {t.loading && <p className="text-noor-textMuted text-sm animate-pulse">{tr("assistant.loading")}</p>}
            {t.error && <p role="alert" className="text-red-400 text-sm">{t.error}</p>}
            {t.answer && <Answer a={t.answer} />}
          </section>
        ))}
      </div>
    </div>
  );
}
