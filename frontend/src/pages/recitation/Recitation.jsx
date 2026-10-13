import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Mic, Square, RotateCcw, Check, AlertTriangle, X } from "lucide-react";
import GlassCard from "../../components/GlassCard";
import { ErrorState, SkeletonCard } from "../../components/Skeleton";
import { fetchSurahs, fetchSurahDetail } from "../../services/quranService";
import { compareRecitation, detectAyah, normalizeArabic } from "../../utils/recitationMatch";
import { useI18n } from "../../context/I18nContext";

// Most Quran texts put the Bismillah at the start of Ayah 1 (except Al-Fatihah, where it IS Ayah 1).
function stripBismillah(text, surahNumber, ayahNumber) {
  if (surahNumber === 1 || ayahNumber !== 1) return text;
  const words = text.trim().split(/\s+/);
  const first4 = normalizeArabic(words.slice(0, 4).join(" "));
  return first4 === "بسم الله الرحمن الرحيم" ? words.slice(4).join(" ") : text;
}

const SpeechRecognition = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

const STATUS_STYLE = {
  match: { box: "border-emerald-500/60 bg-emerald-500/10", icon: <Check size={14} aria-hidden="true" />, label: "rec.s.match" },
  close: { box: "border-amber-400/60 bg-amber-400/10", icon: <AlertTriangle size={14} aria-hidden="true" />, label: "rec.s.close" },
  missed: { box: "border-red-400/60 bg-red-400/10", icon: <X size={14} aria-hidden="true" />, label: "rec.s.missed" },
};

export default function Recitation() {
  const { t, lang, isRTL } = useI18n();
  const sName = (s) => (lang === "en" ? s.englishName : s.name);
  const [surahs, setSurahs] = useState([]);
  const [surahNumber, setSurahNumber] = useState(1);
  const [surah, setSurah] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [mode, setMode] = useState("ayah"); // "ayah" = I choose the Ayah, "detect" = find it for me
  const [ayahNumber, setAyahNumber] = useState(1);
  const [listening, setListening] = useState(false);
  const [finalText, setFinalText] = useState("");
  const [interim, setInterim] = useState("");
  const [micError, setMicError] = useState("");
  const recRef = useRef(null);

  useEffect(() => { fetchSurahs().then(setSurahs).catch(() => {}); }, []);

  const loadSurah = () => {
    setLoadError(false); setSurah(null);
    fetchSurahDetail(surahNumber).then(setSurah).catch(() => setLoadError(true));
  };
  useEffect(() => { loadSurah(); resetRecitation(); setAyahNumber(1); }, [surahNumber]);

  // Stop the microphone if the user leaves the page
  useEffect(() => () => { try { recRef.current?.abort(); } catch (e) { /* ignore */ } }, []);

  function resetRecitation() {
    try { recRef.current?.abort(); } catch (e) { /* ignore */ }
    setListening(false); setFinalText(""); setInterim(""); setMicError("");
  }

  function start() {
    if (!SpeechRecognition) return;
    setMicError(""); setFinalText(""); setInterim("");
    const rec = new SpeechRecognition();
    rec.lang = "ar-SA";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (event) => {
      let fin = "";
      let tmp = "";
      for (let i = 0; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) fin += r[0].transcript + " ";
        else tmp += r[0].transcript + " ";
      }
      setFinalText(fin.trim());
      setInterim(tmp.trim());
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") setMicError(t("rec.err.denied"));
      else if (e.error === "no-speech") setMicError(t("rec.err.noSpeech"));
      else if (e.error === "network") setMicError(t("rec.err.network"));
      else if (e.error !== "aborted") setMicError(t("rec.err.stopped"));
      setListening(false);
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    try { rec.start(); setListening(true); } catch (e) { setMicError(t("rec.err.mic")); }
  }

  function stop() {
    try { recRef.current?.stop(); } catch (e) { /* ignore */ }
    setListening(false);
  }

  const ayahs = useMemo(
    () => (surah ? surah.ayahs.map((a) => ({ numberInSurah: a.numberInSurah, text: stripBismillah(a.arabicText, surah.number, a.numberInSurah) })) : []),
    [surah]
  );

  const heard = `${finalText} ${interim}`.trim();
  const detected = mode === "detect" && heard ? detectAyah(ayahs, heard) : null;
  const targetNumber = mode === "detect" ? detected?.ayahNumber : ayahNumber;
  const target = ayahs.find((a) => a.numberInSurah === targetNumber);
  const result = target && heard ? compareRecitation(target.text, heard) : null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-display text-noor-goldBright mb-2">{t("rec.title")}</h1>
      <p className="text-noor-textMuted mb-4">{t("rec.subtitle")}</p>

      <div role="note" className="glass-card p-4 mb-6 text-sm text-noor-textMuted space-y-1 border-amber-400/40">
        <p><strong className="text-amber-300">{t("rec.warnTitle")}</strong> {t("rec.warnText")}</p>
        <p>{t("rec.teacher")}</p>
        <p>{t("rec.privacyA")} <Link to="/privacy" className="text-noor-goldBright">{t("rec.privacyLink")}</Link>.</p>
      </div>

      {!SpeechRecognition && (
        <GlassCard className="mb-6 text-center">
          <p className="text-noor-textMuted">{t("rec.noSpeech")}</p>
        </GlassCard>
      )}

      <GlassCard className="mb-6 space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-sm">
            <span className="block text-noor-textMuted mb-1">{t("rec.surah")}</span>
            <select value={surahNumber} onChange={(e) => setSurahNumber(Number(e.target.value))} className="w-full rounded-lg bg-noor-surface2 border border-noor-border px-3 py-2">
              {surahs.length === 0 && <option value={surahNumber}>{t("common.surahN", { n: surahNumber })}</option>}
              {surahs.map((s) => <option key={s.number} value={s.number}>{s.number}. {sName(s)}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-noor-textMuted mb-1">{t("rec.ayah")}</span>
            <select value={ayahNumber} disabled={mode === "detect" || !surah} onChange={(e) => { setAyahNumber(Number(e.target.value)); resetRecitation(); }}
              className="w-full rounded-lg bg-noor-surface2 border border-noor-border px-3 py-2 disabled:opacity-50">
              {(surah ? ayahs : [{ numberInSurah: 1 }]).map((a) => <option key={a.numberInSurah} value={a.numberInSurah}>{t("common.ayahN", { n: a.numberInSurah })}</option>)}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label={t("rec.modeAria")}>
          {[["ayah", "rec.modeAyah"], ["detect", "rec.modeDetect"]].map(([id, labelKey]) => (
            <button key={id} aria-pressed={mode === id} onClick={() => { setMode(id); resetRecitation(); }}
              className={`px-3 py-1 rounded-full text-sm border ${mode === id ? "bg-noor-gold text-noor-onAccent border-noor-gold" : "bg-noor-surface2 border-noor-border"}`}>{t(labelKey)}</button>
          ))}
        </div>
      </GlassCard>

      {loadError && <ErrorState message={t("rec.loadError")} onRetry={loadSurah} />}
      {!surah && !loadError && <SkeletonCard />}

      {surah && mode === "ayah" && target && (
        <GlassCard className="mb-6">
          <p className="text-xs text-noor-textMuted mb-2">{t("rec.reciteThis", { ref: `${sName(surah)} ${surah.number}:${target.numberInSurah}` })}</p>
          <p dir="rtl" lang="ar" className="font-arabic text-3xl leading-loose text-right">{target.text}</p>
        </GlassCard>
      )}

      {surah && (
        <div className="flex items-center gap-3 mb-6">
          {!listening ? (
            <button onClick={start} disabled={!SpeechRecognition}
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-noor-gold text-noor-onAccent font-medium disabled:opacity-40">
              <Mic size={18} aria-hidden="true" /> {t("rec.start")}
            </button>
          ) : (
            <button onClick={stop} className="flex items-center gap-2 px-6 py-3 rounded-full bg-red-500 text-white font-medium">
              <Square size={16} aria-hidden="true" /> {t("rec.stop")}
            </button>
          )}
          <button onClick={resetRecitation} className="flex items-center gap-2 px-4 py-3 rounded-full border border-noor-border text-sm">
            <RotateCcw size={16} aria-hidden="true" /> {t("rec.clear")}
          </button>
          {listening && <span role="status" className="text-sm text-emerald-400 animate-pulse">{t("rec.listening")}</span>}
        </div>
      )}
      {micError && <p role="alert" className="text-sm text-red-400 mb-4">{micError}</p>}

      {heard && (
        <GlassCard className="mb-6">
          <p className="text-xs text-noor-textMuted mb-2">{t("rec.heard")}</p>
          <p dir="rtl" lang="ar" className="font-arabic text-xl leading-loose text-right">{heard}</p>
        </GlassCard>
      )}

      {mode === "detect" && heard && !detected && !listening && (
        <p className="text-sm text-noor-textMuted mb-6">{t("rec.noMatch", { surah: surah ? sName(surah) : "" })}</p>
      )}
      {mode === "detect" && detected && (
        <p className="text-sm mb-4">{t("rec.possible")} <Link to={`/quran/${surahNumber}?ayah=${detected.ayahNumber}`} className="text-noor-goldBright">{sName(surah)} {surahNumber}:{detected.ayahNumber}</Link> {t("rec.possibleTail")}</p>
      )}

      {result && (
        <GlassCard>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg">{t("rec.compare")}</h2>
            <p className="text-sm text-noor-textMuted">{t("rec.score")} <strong className="text-noor-goldBright">{result.score}%</strong></p>
          </div>
          <div dir="rtl" lang="ar" className="flex flex-wrap gap-2 mb-4">
            {result.words.map((w, i) => (
              <span key={i} className={`font-arabic text-2xl px-3 py-1 rounded-lg border ${STATUS_STYLE[w.status].box}`}>
                {w.word}
                <span className="sr-only"> — {t(STATUS_STYLE[w.status].label)}</span>
                <span className="inline-block align-middle mx-1" aria-hidden="true">{STATUS_STYLE[w.status].icon}</span>
              </span>
            ))}
          </div>
          <ul className="text-xs text-noor-textMuted flex flex-wrap gap-4 mb-2">
            <li className="flex items-center gap-1"><Check size={12} aria-hidden="true" /> {t("rec.s.match")}</li>
            <li className="flex items-center gap-1"><AlertTriangle size={12} aria-hidden="true" /> {t("rec.s.close")}</li>
            <li className="flex items-center gap-1"><X size={12} aria-hidden="true" /> {t("rec.s.missed")}</li>
          </ul>
          {result.extra.length > 0 && <p className="text-xs text-noor-textMuted">{t("rec.extra")} <span dir="rtl" lang="ar" className="font-arabic">{result.extra.join(" ")}</span></p>}
          <p className="text-xs text-amber-300 mt-3">{t("rec.mistake")}</p>
        </GlassCard>
      )}
    </div>
  );
}
