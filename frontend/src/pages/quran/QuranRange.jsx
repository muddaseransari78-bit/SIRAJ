import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import MushafText from "../../components/MushafText";
import AudioPlayer from "../../components/AudioPlayer";
import ViewModeToggle from "../../components/ViewModeToggle";
import useTajweed from "../../hooks/useTajweed";
import AyahCard from "../../components/AyahCard";
import ReadingControls from "../../components/ReadingControls";
import CompleteToggle from "../../components/CompleteToggle";
import { SkeletonCard, ErrorState } from "../../components/Skeleton";
import { useToast } from "../../components/Toast";
import useReadingSettings from "../../hooks/useReadingSettings";
import useAyahActions from "../../hooks/useAyahActions";
import { fetchRange } from "../../services/quranService";
import { useI18n } from "../../context/I18nContext";

const TYPES = ["juz", "page", "hizb", "ruku"];

// Reads a Juz / Page / Hizb quarter / Ruku - can contain ayahs from several Surahs.
export default function QuranRange() {
  const { type, number } = useParams();
  const num = Number(number);
  const [range, setRange] = useState(null);
  const [error, setError] = useState(false);
  const [settings, updateSettings] = useReadingSettings();
  const { t } = useI18n();
  const { toastEl, notify } = useToast();
  const actions = useAyahActions(notify);
  const navigate = useNavigate();
  const [pageJump, setPageJump] = useState("");
  const [searchParams] = useSearchParams();
  const wantPlay = searchParams.get("play") === "1";   // ?play=1 starts the audio
  const wantView = searchParams.get("view");           // ?view=mushaf or ?view=cards
  const [playing, setPlaying] = useState(null);        // { s, n } of the Ayah being recited
  const [startRequest, setStartRequest] = useState(null);
  const [selected, setSelected] = useState(null);      // Mushaf view: the Ayah you tapped
  const tajweed = useTajweed(settings.showTajweed, range ? range.ayahs.map((a) => a.surahNumber) : []);

  function load() {
    setError(false);
    setRange(null);
    fetchRange(type, num).then(setRange).catch(() => setError(true));
  }

  useEffect(() => {
    load();
    window.scrollTo(0, 0);
    setPlaying(null);
    setStartRequest(null);
    setSelected(null);
  }, [type, num]);

  useEffect(() => {
    if (wantView === "mushaf") updateSettings({ mushafView: true });
    else if (wantView === "cards") updateSettings({ mushafView: false });
  }, [wantView]);

  // Follow the recitation: scroll the Ayah being recited into view
  useEffect(() => {
    if (playing) document.getElementById(`ayah-${playing.s}-${playing.n}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [playing]);

  const playAyah = (a) => setStartRequest({ n: a.numberInSurah, s: a.surahNumber, t: Date.now() });
  const tapAyah = (a) => { setSelected(a); playAyah(a); };

  if (!TYPES.includes(type)) return <div className="max-w-3xl mx-auto px-4 py-12"><ErrorState message={t("reader.unknownView")} /></div>;
  if (error) return <div className="max-w-3xl mx-auto px-4 py-12"><ErrorState message={t("reader.sectionError")} onRetry={load} /></div>;
  if (!range) return <div className="max-w-3xl mx-auto px-4 py-12 space-y-4"><SkeletonCard /><SkeletonCard /></div>;

  const label = t(`quran.tab.${type}`);
  const soft = settings.theme === "soft";
  let lastSurah = null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 pb-40">
      {toastEl}
      <div className="text-center mb-8">
        <p className="text-noor-textMuted text-sm mb-1">{t("range.readingBy", { label })}</p>
        <h1 className="text-3xl font-display text-noor-goldBright">{label} {range.number} <span className="text-noor-textMuted text-lg">{t("range.of", { max: range.max })}</span></h1>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <ViewModeToggle settings={settings} onChange={updateSettings} />
        {type === "page" && (
          <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); const n = Number(pageJump); if (Number.isInteger(n) && n >= 1 && n <= range.max) { navigate(`/quran/page/${n}`); setPageJump(""); } else notify(t("reader.jumpError", { max: range.max })); }}>
            <label htmlFor="jump-page" className="text-sm text-noor-textMuted">{t("reader.jumpToPage")}</label>
            <input id="jump-page" type="number" min="1" max={range.max} value={pageJump} onChange={(e) => setPageJump(e.target.value)} className="w-24 rounded-lg bg-noor-surface2 border border-noor-border px-3 py-1.5 text-sm" />
            <button className="px-3 py-1.5 rounded-lg bg-noor-gold text-noor-onAccent text-sm">{t("common.go")}</button>
          </form>
        )}
      </div>
      {settings.mushafView && <p className="text-xs text-noor-textMuted mb-4">{t("reader.mushafNote")} {t("reader.mushafTapHint")}</p>}
      {settings.showTajweed && tajweed.status === "error" && <p role="status" className="text-xs text-amber-400 mb-4">{t("reader.tajweedUnavailable")}</p>}
      {settings.showTajweed && tajweed.status === "toomany" && <p role="status" className="text-xs text-amber-400 mb-4">{t("reader.tajweedTooMany")}</p>}

      <ReadingControls settings={settings} onChange={updateSettings} hasUrdu={!!range.urduSource} hasTransliteration={!!range.transliterationSource} />

      <div className={soft ? "reader-soft p-4 sm:p-6" : ""}>
        {settings.mushafView ? (
          <>
            <MushafText
              ayahs={range.ayahs} settings={settings} tajweedMap={tajweed.map}
              playingKey={playing ? `${playing.s}:${playing.n}` : null}
              selectedKey={selected ? `${selected.surahNumber}:${selected.numberInSurah}` : null}
              onAyahClick={tapAyah}
            />
            {selected && (
              <div className="mt-8" aria-live="polite">
                <p className="text-xs text-noor-textMuted mb-2">{t("reader.selectedAyah")}</p>
                <AyahCard
                  key={`${selected.surahNumber}:${selected.numberInSurah}`}
                  noAnchor ayah={selected} settings={settings} notify={notify} showSurahLabel
                  highlighted={playing?.s === selected.surahNumber && playing?.n === selected.numberInSurah}
                  onPlay={playAyah}
                  onBookmark={actions.bookmark} onMarkRead={actions.markRead} onSaveNote={actions.saveNote}
                  tajweedText={tajweed.map[`${selected.surahNumber}:${selected.numberInSurah}`]}
                />
              </div>
            )}
          </>
        ) : (
        <div className="space-y-8">
          {range.ayahs.map((ayah) => {
            const startsSurah = ayah.surahNumber !== lastSurah;
            lastSurah = ayah.surahNumber;
            return (
              <React.Fragment key={ayah.globalAyahNumber}>
                {startsSurah && (
                  <div className="text-center pt-2">
                    <Link to={`/quran/${ayah.surahNumber}`} className="font-arabic text-2xl text-noor-goldBright">{ayah.surahName}</Link>
                    <p className="text-xs text-noor-textMuted">{ayah.surahEnglishName}</p>
                  </div>
                )}
                <AyahCard
                  ayah={ayah} settings={settings} notify={notify}
                  highlighted={playing?.s === ayah.surahNumber && playing?.n === ayah.numberInSurah}
                  onPlay={playAyah}
                  onBookmark={actions.bookmark} onMarkRead={actions.markRead} onSaveNote={actions.saveNote}
                  showSurahLabel
                  tajweedText={tajweed.map[`${ayah.surahNumber}:${ayah.numberInSurah}`]}
                />
              </React.Fragment>
            );
          })}
        </div>
        )}

        <div className="mt-8 text-xs text-noor-textMuted space-y-1">
          <p>{t("reader.srcArabic")}</p>
          <p>{t("reader.srcEnglish", { s: range.translationSource })}</p>
          {range.urduSource && <p>{t("reader.srcUrdu", { s: range.urduSource })}</p>}
          {range.transliterationSource && <p>{t("reader.srcTranslit", { s: range.transliterationSource })}</p>}
        </div>
      </div>

      <p className="text-xs text-noor-textMuted mt-4">{t("range.audioNote", { label })}</p>

      {type === "juz" && <CompleteToggle type="juz" number={num} notify={notify} />}

      <AudioPlayer
        ayahs={range.ayahs}
        onAyahChange={(n, sNum) => setPlaying(n ? { n, s: sNum } : null)}
        startRequest={startRequest}
        autoStart={wantPlay}
      />

      <div className="flex items-center justify-between mt-10">
        {num > 1 ? (
          <Link to={`/quran/${type}/${num - 1}`} className="flex items-center gap-1 text-sm text-noor-textMuted hover:text-noor-goldBright"><ChevronLeft size={16} className="rtl:rotate-180" /> {t("reader.prevItem", { label })}</Link>
        ) : <span />}
        {num < range.max ? (
          <Link to={`/quran/${type}/${num + 1}`} className="flex items-center gap-1 text-sm text-noor-textMuted hover:text-noor-goldBright">{t("reader.nextItem", { label })} <ChevronRight size={16} className="rtl:rotate-180" /></Link>
        ) : <span />}
      </div>
    </div>
  );
}
