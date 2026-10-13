import React, { useEffect, useState } from "react";
import { useParams, useSearchParams, useNavigate, useLocation, Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import AudioPlayer from "../../components/AudioPlayer";
import AyahCard from "../../components/AyahCard";
import MushafText from "../../components/MushafText";
import ViewModeToggle from "../../components/ViewModeToggle";
import ReadingControls from "../../components/ReadingControls";
import CompleteToggle from "../../components/CompleteToggle";
import { SkeletonCard, ErrorState } from "../../components/Skeleton";
import { useToast } from "../../components/Toast";
import useReadingSettings from "../../hooks/useReadingSettings";
import useAyahActions from "../../hooks/useAyahActions";
import useTajweed from "../../hooks/useTajweed";
import { useI18n } from "../../context/I18nContext";
import { fetchSurahDetail } from "../../services/quranService";
import { resolveSurahParam, surahSlug, surahPath } from "../../utils/surahSlugs";

export default function SurahReader() {
  const { surahNumber } = useParams();
  const [searchParams] = useSearchParams();
  const [surah, setSurah] = useState(null);
  const [error, setError] = useState(false);
  const [settings, updateSettings] = useReadingSettings();
  const [playingAyah, setPlayingAyah] = useState(null);
  const [startRequest, setStartRequest] = useState(null);
  const [selectedAyah, setSelectedAyah] = useState(null); // Mushaf view: the Ayah you tapped (its actions show below the text)
  const [jumpValue, setJumpValue] = useState("");
  const { t } = useI18n();
  const { toastEl, notify } = useToast();
  const actions = useAyahActions(notify);

  // NOTE: `num` must be declared BEFORE it is used by useTajweed below
  // The address may be a slug (/quran/al-fatiha) or an old number link (/quran/1)
  const num = resolveSurahParam(surahNumber) ?? NaN;
  const targetAyah = Number(searchParams.get("ayah")) || null;
  // Links from the Quran list: ?play=1 starts the audio, ?view=mushaf / ?view=cards picks the layout
  const wantPlay = searchParams.get("play") === "1";
  const wantView = searchParams.get("view");
  const tajweed = useTajweed(settings.showTajweed, Number.isInteger(num) ? [num] : []);

  // Old number links -> the readable address (same page, no reload, keeps ?ayah= and #ayah-...)
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    if (Number.isInteger(num) && surahNumber !== surahSlug(num)) {
      navigate(`${surahPath(num)}${location.search}${location.hash}`, { replace: true });
    }
  }, [num, surahNumber]);

  function load() {
    setError(false);
    setSurah(null);
    fetchSurahDetail(num).then(setSurah).catch(() => setError(true));
  }

  useEffect(() => {
    load();
    window.scrollTo(0, 0);
    setPlayingAyah(null);
    setStartRequest(null);
    setSelectedAyah(null);
  }, [num]);

  useEffect(() => {
    if (wantView === "mushaf") updateSettings({ mushafView: true });
    else if (wantView === "cards") updateSettings({ mushafView: false });
  }, [wantView]);

  // ?ayah=N in the link -> scroll to that Ayah once the Surah has loaded
  useEffect(() => {
    if (surah && targetAyah) scrollToAyah(targetAyah);
  }, [surah]);

  useEffect(() => {
    if (playingAyah) scrollToAyah(playingAyah.n);
  }, [playingAyah]);

  // Mushaf view: tap an Ayah = recite it and show its actions (bookmark, Tafseer, note...) below the text
  function tapAyah(ayah) {
    setSelectedAyah(ayah);
    setStartRequest({ n: ayah.numberInSurah, s: ayah.surahNumber, t: Date.now() });
  }

  function scrollToAyah(n) {
    document.getElementById(`ayah-${num}-${n}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function jump(e) {
    e.preventDefault();
    const n = Number(jumpValue);
    if (!surah || !Number.isInteger(n) || n < 1 || n > surah.numberOfAyahs) {
      return notify(t("reader.jumpError", { max: surah?.numberOfAyahs || "…" }));
    }
    scrollToAyah(n);
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <ErrorState message={t("reader.loadError")} onRetry={load} />
      </div>
    );
  }

  if (!surah) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-4">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  const soft = settings.theme === "soft";

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 pb-40">
      {toastEl}

      <div className="text-center mb-8">
        <p className="text-noor-textMuted text-sm mb-1">{t(`quran.${surah.revelationType}`)} • {t("quran.ayahsCount", { n: surah.numberOfAyahs })}</p>
        <h1 className="font-arabic text-4xl text-noor-goldBright mb-1">{surah.name}</h1>
        <h2 className="text-xl font-display">{surah.englishName}</h2>
        <p className="text-sm text-noor-textMuted">{surah.englishNameTranslation}</p>
      </div>

      <div className="mb-4">
        <ViewModeToggle settings={settings} onChange={updateSettings} />
        {settings.mushafView && <p className="text-xs text-noor-textMuted mt-2">{t("reader.mushafNote")} {t("reader.mushafTapHint")}</p>}
      </div>

      <ReadingControls
        settings={settings}
        onChange={updateSettings}
        hasUrdu={!!surah.urduSource}
        hasTransliteration={!!surah.transliterationSource}
      />

      {settings.showTajweed && tajweed.status === "error" && <p role="status" className="text-xs text-amber-400 mb-4">{t("reader.tajweedUnavailable")}</p>}

      <form onSubmit={jump} className="flex items-center gap-2 mb-6">
        <label htmlFor="jump-ayah" className="text-sm text-noor-textMuted">{t("reader.jumpToAyah")}</label>
        <input
          id="jump-ayah" type="number" min="1" max={surah.numberOfAyahs} value={jumpValue}
          onChange={(e) => setJumpValue(e.target.value)}
          className="w-24 rounded-lg bg-noor-surface2 border border-noor-border px-3 py-1.5 text-sm"
        />
        <button type="submit" className="px-3 py-1.5 rounded-lg bg-noor-gold text-noor-onAccent text-sm">{t("common.go")}</button>
      </form>

      <div className={soft ? "reader-soft p-4 sm:p-6" : ""}>
        {settings.mushafView ? (
          <>
            <MushafText
              ayahs={surah.ayahs} settings={settings} tajweedMap={tajweed.map}
              playingKey={playingAyah ? `${playingAyah.s}:${playingAyah.n}` : null}
              selectedKey={selectedAyah ? `${selectedAyah.surahNumber}:${selectedAyah.numberInSurah}` : null}
              onAyahClick={tapAyah}
            />
            {selectedAyah && (
              <div className="mt-8" aria-live="polite">
                <p className="text-xs text-noor-textMuted mb-2">{t("reader.selectedAyah")}</p>
                <AyahCard
                  key={selectedAyah.numberInSurah}
                  noAnchor
                  ayah={selectedAyah}
                  settings={settings}
                  highlighted={playingAyah?.n === selectedAyah.numberInSurah}
                  onPlay={(a) => setStartRequest({ n: a.numberInSurah, s: a.surahNumber, t: Date.now() })}
                  onBookmark={actions.bookmark}
                  onMarkRead={actions.markRead}
                  onSaveNote={actions.saveNote}
                  notify={notify}
                  tajweedText={tajweed.map[`${num}:${selectedAyah.numberInSurah}`]}
                />
              </div>
            )}
          </>
        ) : (
        <div className="space-y-8">
          {surah.ayahs.map((ayah) => (
            <AyahCard
              key={ayah.numberInSurah}
              ayah={ayah}
              settings={settings}
              highlighted={playingAyah?.n === ayah.numberInSurah}
              onPlay={(a) => setStartRequest({ n: a.numberInSurah, s: a.surahNumber, t: Date.now() })}
              onBookmark={actions.bookmark}
              onMarkRead={actions.markRead}
              onSaveNote={actions.saveNote}
              notify={notify}
              tajweedText={tajweed.map[`${num}:${ayah.numberInSurah}`]}
            />
          ))}
        </div>
        )}

        {/* Sources are always shown */}
        <div className="mt-8 text-xs text-noor-textMuted space-y-1">
          <p>{t("reader.srcArabic")}</p>
          <p>{t("reader.srcEnglish", { s: surah.translationSource })}</p>
          {surah.urduSource && <p>{t("reader.srcUrdu", { s: surah.urduSource })}</p>}
          {surah.transliterationSource && <p>{t("reader.srcTranslit", { s: surah.transliterationSource })}</p>}
        </div>
      </div>

      <CompleteToggle type="surah" number={num} notify={notify} />

      <AudioPlayer
        surahNumber={num}
        onAyahChange={(n, sNum) => setPlayingAyah(n ? { n, s: sNum ?? num } : null)}
        startRequest={startRequest}
        autoStart={wantPlay}
      />

      <div className="flex items-center justify-between mt-10">
        {num > 1 ? (
          <Link to={`/quran/${num - 1}`} className="flex items-center gap-1 text-sm text-noor-textMuted hover:text-noor-goldBright">
            <ChevronLeft size={16} className="rtl:rotate-180" /> {t("reader.prevSurah")}
          </Link>
        ) : <span />}
        {num < 114 ? (
          <Link to={`/quran/${num + 1}`} className="flex items-center gap-1 text-sm text-noor-textMuted hover:text-noor-goldBright">
            {t("reader.nextSurah")} <ChevronRight size={16} className="rtl:rotate-180" />
          </Link>
        ) : <span />}
      </div>
    </div>
  );
}
