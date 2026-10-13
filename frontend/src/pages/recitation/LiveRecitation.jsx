import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Mic, Square, RotateCcw, Check, AlertTriangle, X, SkipForward, Repeat, Volume2, Search, Save, BellRing } from "lucide-react";
import GlassCard from "../../components/GlassCard";
import { ErrorState, SkeletonCard } from "../../components/Skeleton";
import { fetchSurahs, fetchSurahDetail, fetchSurahAudio } from "../../services/quranService";
import { globalSearch } from "../../services/contentService";
import { normalizeArabic, splitWords } from "../../utils/recitationMatch";
import { alignLive, finalizeLive } from "../../utils/liveRecitation";
import { audioUrlForAyah } from "../../utils/ayahAudio";
import { detectAyahCandidates, MIN_WORDS } from "../../utils/ayahDetect";
import { buildSessionPayload, ayahsToRepeat } from "../../utils/recitationSession";
import { localDate } from "../../utils/date";
import { useAuth } from "../../context/AuthContext";
import useAyahRecorder, { RECORDING_SUPPORTED } from "../../hooks/useAyahRecorder";
import useMistakeAlert from "../../hooks/useMistakeAlert";
import { mistakeSound, unlock as unlockSound, loadAlertPref, saveAlertPref } from "../../services/mistakeSound";
import { fetchHarakatStatus, checkHarakat, checkHarakatLive, saveRecitationSession } from "../../services/recitationService";
import { confirmMistakes } from "../../utils/liveHarakat";
import { describeDiffT } from "../../utils/harakatLabels";
import { useI18n } from "../../context/I18nContext";
import { HarakatResultsCard } from "../../components/HarakatResult";

// Most Quran texts put the Bismillah at the start of Ayah 1 (except Al-Fatihah, where it IS Ayah 1).
function stripBismillah(text, surahNumber, ayahNumber) {
  if (surahNumber === 1 || ayahNumber !== 1) return text;
  const words = text.trim().split(/\s+/);
  const first4 = normalizeArabic(words.slice(0, 4).join(" "));
  return first4 === "بسم الله الرحمن الرحيم" ? words.slice(4).join(" ") : text;
}

const SpeechRecognition = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

const WORD_STYLE = {
  upcoming: "border-noor-border text-noor-textMuted opacity-60",
  current: "border-noor-gold bg-noor-surface2 ring-2 ring-noor-gold animate-pulse",
  match: "border-emerald-500/60 bg-emerald-500/10",
  close: "border-amber-400/60 bg-amber-400/10",
  different: "border-red-400/60 bg-red-400/10",
  missed: "border-red-400/60 bg-red-400/10",
  neutral: "border-transparent",
};
const WORD_LABEL = {
  upcoming: "live.w.upcoming",
  current: "live.w.current",
  match: "live.w.match",
  close: "live.w.close",
  different: "live.w.different",
  missed: "live.w.missed",
};

function WordIcon({ status }) {
  if (status === "match") return <Check size={14} className="text-emerald-400" aria-hidden="true" />;
  if (status === "close") return <AlertTriangle size={14} className="text-amber-300" aria-hidden="true" />;
  if (status === "different" || status === "missed") return <X size={14} className="text-red-400" aria-hidden="true" />;
  return null;
}

export default function LiveRecitation() {
  const { t, lang } = useI18n();
  const sName = (x) => (lang === "en" ? x.englishName : x.name);
  const [surahs, setSurahs] = useState([]);
  const [surahNumber, setSurahNumber] = useState(1);
  const [surah, setSurah] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [ayahNumber, setAyahNumber] = useState(1);
  const [autoNext, setAutoNext] = useState(true);
  const [listening, setListening] = useState(false);
  const [heardWords, setHeardWords] = useState([]); // every word heard in this practice session
  const [offset, setOffset] = useState(0); // heard words already used by earlier Ayahs
  const [history, setHistory] = useState([]); // finished Ayahs: { ayahNumber, score, problems }
  const [finished, setFinished] = useState(false);
  const [micError, setMicError] = useState("");
  const [detected, setDetected] = useState(null); // null | { tooFew: true } | { none: true } | result of detectAyahCandidates
  const [wide, setWide] = useState(null);         // search of the WHOLE Quran when the chosen Surah has no match: null | { state: "loading" | "done" | "error", results }
  const wideRunRef = useRef(0);
  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved | error
  const [saveMessage, setSaveMessage] = useState("");
  const [playing, setPlaying] = useState(false); // the correct recitation of the Ayah is playing
  const [audioError, setAudioError] = useState("");
  const audioRef = useRef(null);
  const playTicketRef = useRef(0); // counts play requests, so a late answer of an old click is ignored
  const audioListRef = useRef({ surah: 0, list: [] }); // per-Ayah audio links of the chosen Surah
  // Optional server check of zabar / zer / pesh (needs login + a pronunciation service on the server)
  const { user } = useAuth();
  const recorder = useAyahRecorder();
  const [harakatEnabled, setHarakatEnabled] = useState(null); // null = still asking the server
  const [harakatOn, setHarakatOn] = useState(() => { try { return localStorage.getItem("siraj.harakatOn") === "on"; } catch (e) { return false; } });
  const [liveHarakat, setLiveHarakat] = useState(null); // newest LIVE zabar/zer answer for the Ayah being recited
  const [harakatResults, setHarakatResults] = useState({}); // ayahNumber -> { state, result?, message? }
  const [harakatNote, setHarakatNote] = useState("");
  const [alertOn, setAlertOn] = useState(loadAlertPref); // alert sound when a mistake is heard
  const alertOnRef = useRef(true);
  const [alertNote, setAlertNote] = useState(""); // the last mistake, shown in words
  const [flash, setFlash] = useState({}); // wordIndex -> number, bumps to replay the red flash
  const harakatAlertedRef = useRef(new Set()); // Ayahs whose zabar/zer/pesh result already beeped
  const livePrevRef = useRef({}); // mistakes of the previous live answer (a mistake must repeat to count)
  const liveFiredRef = useRef({}); // ayahNumber -> Set of word positions that already beeped (live)
  const liveBusyRef = useRef(false); // one live request at a time
  const liveSentRef = useRef(0); // size of the audio sent last time (only send when there is more audio)
  const liveStopRef = useRef(false); // the model writes no harakat: stop asking
  const liveCtxRef = useRef({});
  const recordingRef = useRef(false); // true while audio is being kept for the zabar/zer/pesh check
  const runRef = useRef(0); // bumps on every reset so late replies from an old session are ignored
  const harakatActive = harakatOn && harakatEnabled === true && Boolean(user) && RECORDING_SUPPORTED;

  const recRef = useRef(null);
  const wantRef = useRef(false); // true while the user wants the microphone on
  const baseRef = useRef([]); // words from speech sessions that already ended
  const sessionRef = useRef(""); // text of the current speech session
  const liveRef = useRef(null);

  useEffect(() => { fetchSurahs().then(setSurahs).catch(() => {}); }, []);
  useEffect(() => { fetchHarakatStatus().then(setHarakatEnabled).catch(() => setHarakatEnabled(false)); }, []);

  const loadSurah = () => {
    setLoadError(false); setSurah(null);
    fetchSurahDetail(surahNumber).then(setSurah).catch(() => setLoadError(true));
  };
  useEffect(() => { loadSurah(); hardReset(); setAyahNumber(1); }, [surahNumber]);

  // Turn the microphone off if the user leaves the page
  useEffect(() => () => {
    try { audioRef.current?.pause(); } catch (e) { /* ignore */ }
    wantRef.current = false;
    try { recRef.current?.abort(); } catch (e) { /* ignore */ }
    recRef.current = null;
  }, []);

  function hardReset() {
    wantRef.current = false;
    try { recRef.current?.abort(); } catch (e) { /* ignore */ }
    recRef.current = null; // old handlers ignore anything that arrives after this
    baseRef.current = []; sessionRef.current = "";
    recordingRef.current = false; runRef.current += 1; recorder.close();
    setHarakatResults({}); setHarakatNote(""); harakatAlertedRef.current = new Set(); liveFiredRef.current = {}; livePrevRef.current = {}; liveSentRef.current = 0; liveStopRef.current = false; setLiveHarakat(null); setAlertNote(""); setFlash({});
    setListening(false); setHeardWords([]); setOffset(0); setHistory([]); setFinished(false); setMicError("");
    setDetected(null); setWide(null); wideRunRef.current += 1; setSaveState("idle"); setSaveMessage(""); stopReference();
  }

  // Chrome stops listening by itself after a pause. While the user still wants to recite,
  // we simply start a new speech session and keep the words heard so far.
  function launch() {
    const rec = new SpeechRecognition();
    rec.lang = "ar-SA";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (event) => {
      if (recRef.current !== rec) return;
      let text = "";
      for (let i = 0; i < event.results.length; i++) text += event.results[i][0].transcript + " ";
      sessionRef.current = text;
      setHeardWords([...baseRef.current, ...splitWords(text)]);
    };
    rec.onerror = (e) => {
      if (recRef.current !== rec) return;
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setMicError(t("live.e.denied"));
        wantRef.current = false;
      } else if (e.error === "network") {
        setMicError(t("live.e.network"));
        wantRef.current = false;
      } else if (e.error !== "aborted" && e.error !== "no-speech") {
        setMicError(t("live.e.stopped"));
        wantRef.current = false;
      }
    };
    rec.onend = () => {
      if (recRef.current !== rec) return;
      baseRef.current = [...baseRef.current, ...splitWords(sessionRef.current)];
      sessionRef.current = "";
      if (wantRef.current) {
        try { launch(); } catch (e) { wantRef.current = false; setListening(false); }
      } else {
        setListening(false);
      }
    };
    recRef.current = rec;
    rec.start();
    setListening(true);
  }

  function start() {
    if (!SpeechRecognition || listening) return;
    stopReference(); // the microphone must never hear the reference recitation
    unlockSound(); // browsers allow sound only after a click: this click is it
    setMicError(""); setHarakatNote(""); setFinished(false);
    recordingRef.current = false;
    if (harakatActive) {
      recorder.open().then((ok) => {
        recordingRef.current = ok;
        if (!ok) setHarakatNote(t("live.e.recordFail"));
      });
    }
    wantRef.current = true;
    try { launch(); } catch (e) { wantRef.current = false; setMicError(t("live.e.mic")); }
  }

  function stop() {
    wantRef.current = false;
    recordingRef.current = false; recorder.close(); // the Ayah you were in the middle of is not sent
    try { recRef.current?.stop(); } catch (e) { /* ignore */ }
  }

  // ---- Listen to the correct recitation of this Ayah (never while the microphone is on) ----
  function stopReference() {
    playTicketRef.current += 1; // cancels a play request that is still loading
    try { audioRef.current?.pause(); } catch (e) { /* ignore */ }
    audioRef.current = null;
    setPlaying(false);
  }

  async function playReference() {
    if (listening || !target) return;
    if (playing) { stopReference(); return; }
    setAudioError("");
    const forSurah = surahNumber;
    const forAyah = ayahNumber;
    const ticket = ++playTicketRef.current; // a newer click / another Ayah makes this one stale
    const stale = () => ticket !== playTicketRef.current;
    try {
      // The server answers with an object { ayahs: [...] }; audioUrlForAyah understands it
      if (audioListRef.current.surah !== forSurah) {
        const data = await fetchSurahAudio(forSurah);
        audioListRef.current = { surah: forSurah, list: data };
      }
      if (stale()) return;
      const url = audioUrlForAyah(audioListRef.current.list, forAyah);
      if (!url) { setAudioError(t("live.e.noAudio")); return; }
      try { audioRef.current?.pause(); } catch (e) { /* ignore */ } // (stopReference() would cancel THIS request)
      const audio = new Audio(url);
      audio.preload = "auto";
      audioRef.current = audio;
      audio.onended = () => { if (audioRef.current === audio) { audioRef.current = null; setPlaying(false); } };
      audio.onerror = () => { if (audioRef.current === audio) { audioRef.current = null; setPlaying(false); setAudioError(t("live.e.playFail")); } };
      setPlaying(true); // the button shows "Stop audio" right away
      await audio.play();
    } catch (e) {
      if (stale()) return;
      audioRef.current = null;
      setPlaying(false);
      // NotAllowedError = the browser blocked autoplay; anything else while fetching = could not load
      setAudioError(t(e && e.name === "NotAllowedError" ? "live.e.playFail" : "live.e.loadFail"));
    }
  }

  // ---- "Which Ayah am I reciting?" (looks only inside the chosen Surah) ----
  function detectNow() {
    const words = heardWords.slice(offset);
    setWide(null); wideRunRef.current += 1;
    if (words.length < MIN_WORDS) { setDetected({ tooFew: true }); return; } // the button always answers, it never sits there dead
    const found = detectAyahCandidates(ayahs, words);
    if (found) { setDetected(found); return; }
    setDetected({ none: true });
    searchWholeQuran(words);
  }

  // Not in the chosen Surah: look for the heard words in the whole Quran (Arabic text) and list the Ayahs found
  async function searchWholeQuran(words) {
    const run = wideRunRef.current;
    setWide({ state: "loading", results: [] });
    try {
      let results = [];
      for (const n of [4, 3]) { // the first words first; fewer words if nothing matched
        const data = await globalSearch(words.slice(0, n).join(" "), { types: "quran", limit: 5 });
        if (run !== wideRunRef.current) return;
        results = (data.quran || []).filter((r) => r.matches?.some((m) => m.kind === "arabic"));
        if (results.length) break;
      }
      setWide({ state: "done", results });
    } catch (e) {
      if (run === wideRunRef.current) setWide({ state: "error", results: [] });
    }
  }

  // Jump to the suggested Ayah. The words already heard are kept, so they are checked against the new Ayah.
  function jumpTo(n) {
    if (recordingRef.current) recorder.cut(false); // the piece recorded so far belongs to another Ayah
    setAyahNumber(n); setHistory([]); setFinished(false); setDetected(null); setWide(null);
  }

  // ---- Save the SCORES of this session to the account (the user presses the button; audio and words are never sent) ----
  async function saveSession() {
    const payload = buildSessionPayload(surahNumber, history, localDate());
    if (!payload) return;
    setSaveState("saving"); setSaveMessage("");
    try { await saveRecitationSession(payload); setSaveState("saved"); }
    catch (err) { setSaveState("error"); setSaveMessage(err.response?.data?.message || t("live.e.saveFail")); }
  }

  useEffect(() => { stopReference(); setDetected(null); setWide(null); setAudioError(""); }, [ayahNumber, surahNumber]);
  useEffect(() => { setSaveState((st) => (st === "saved" ? "idle" : st)); }, [history.length]);

  const ayahs = useMemo(
    () => (surah ? surah.ayahs.map((a) => ({ numberInSurah: a.numberInSurah, text: stripBismillah(a.arabicText, surah.number, a.numberInSurah) })) : []),
    [surah]
  );
  const target = ayahs.find((a) => a.numberInSurah === ayahNumber);
  const live = useMemo(() => (target ? alignLive(target.text, heardWords.slice(offset)) : null), [target, heardWords, offset]);
  liveRef.current = live;
  alertOnRef.current = alertOn;

  // Alert sound + red flash the moment a mistake is heard (see utils/mistakeAlerts.js for the timing rules)
  useMistakeAlert({
    live,
    enabled: alertOn && listening && !finished,
    resetKey: `${surahNumber}:${ayahNumber}:${offset}`,
    onAlert: (fired) => {
      const words = fired.map((m) => liveRef.current?.words[m.index]?.word).filter(Boolean);
      const wrong = fired.some((m) => m.kind === "wrong");
      setAlertNote(t(wrong ? "live.e.alertWrong" : "live.e.alertCheck", { words: words.join(" ، ") }));
      setFlash((f) => { const n = { ...f }; fired.forEach((m) => { n[m.index] = (n[m.index] || 0) + 1; }); return n; });
    },
  });
  useEffect(() => {
    setAlertNote(""); setFlash({});
    setLiveHarakat(null); livePrevRef.current = {}; liveSentRef.current = 0; delete liveFiredRef.current[ayahNumber];
  }, [ayahNumber, surahNumber, offset]);
  liveCtxRef.current = { surahNumber, ayahNumber, offset };

  // LIVE zabar / zer / pesh: about every 1.5 s the audio of this Ayah so far goes to the server and comes back with the
  // words checked so far. A mistake must show up twice in a row before the alarm (see utils/liveHarakat.js).
  useEffect(() => {
    if (!harakatActive || !listening || finished) return undefined;
    const run = runRef.current;
    const id = setInterval(() => {
      if (liveBusyRef.current || liveStopRef.current || !recordingRef.current) return;
      const blob = recorder.snapshot();
      if (!blob || blob.size < 8000 || blob.size - liveSentRef.current < 4000) return;
      const ctx = { ...liveCtxRef.current };
      liveBusyRef.current = true;
      liveSentRef.current = blob.size;
      checkHarakatLive(blob, ctx.surahNumber, ctx.ayahNumber)
        .then((result) => {
          const now = liveCtxRef.current;
          if (run !== runRef.current || now.ayahNumber !== ctx.ayahNumber || now.surahNumber !== ctx.surahNumber || now.offset !== ctx.offset) return; // old answer
          if (!result.available) {
            if (result.reason === "no-harakat") { liveStopRef.current = true; setHarakatNote(t("live.e.noHarakat")); }
            return;
          }
          setLiveHarakat(result);
          const { fire, map } = confirmMistakes(livePrevRef.current, result, liveFiredRef.current[ctx.ayahNumber] || new Set());
          livePrevRef.current = map;
          if (fire.length) {
            const set = liveFiredRef.current[ctx.ayahNumber] || new Set();
            fire.forEach((i) => set.add(i));
            liveFiredRef.current[ctx.ayahNumber] = set;
            if (alertOnRef.current) mistakeSound.wrong();
            const first = result.words[fire[0]];
            setAlertNote(t("live.e.hMistake", { word: first.word, diffs: first.diffs.map((d) => describeDiffT(t, d)).join("; ") }));
            setFlash((f) => { const n = { ...f }; fire.forEach((i) => { n[i] = (n[i] || 0) + 1; }); return n; });
          }
        })
        .catch((err) => {
          if (run !== runRef.current) return;
          const status = err?.response?.status;
          if (status === 401 || status === 503) { liveStopRef.current = true; setHarakatNote(err?.response?.data?.message || t("live.e.liveStopped")); }
        })
        .finally(() => { liveBusyRef.current = false; });
    }, 1500);
    return () => clearInterval(id);
  }, [harakatActive, listening, finished]);


  // The zabar / zer / pesh check answers a few seconds after each Ayah: beep if it found a wrong mark
  useEffect(() => {
    if (!alertOn) return;
    Object.entries(harakatResults).forEach(([ayah, r]) => {
      if (r.state !== "done" || !r.result?.available || harakatAlertedRef.current.has(ayah)) return;
      harakatAlertedRef.current.add(ayah);
      // words the LIVE check already beeped for do not beep again
      const fired = liveFiredRef.current[ayah] || new Set();
      const fresh = r.result.words.map((w, i) => (w.status === "harakat" && !fired.has(i) ? i : -1)).filter((i) => i >= 0);
      if (fresh.length > 0) { mistakeSound.wrong(); setAlertNote(t("live.e.hFound", { n: ayah, c: fresh.length })); }
    });
  }, [harakatResults, alertOn]);

  // Finish the current Ayah and move on (or end the Surah).
  // Cuts the recording at the end of this Ayah and sends just that piece to the server.
  function submitHarakat(forAyah) {
    if (!recordingRef.current) return;
    const run = runRef.current;
    const surahNo = surahNumber;
    recorder.cut(true).then((blob) => {
      if (!blob || blob.size < 2000 || run !== runRef.current) return;
      setHarakatResults((r) => ({ ...r, [forAyah]: { state: "loading" } }));
      checkHarakat(blob, surahNo, forAyah)
        .then((result) => { if (run === runRef.current) setHarakatResults((r) => ({ ...r, [forAyah]: { state: "done", result } })); })
        .catch((err) => {
          if (run !== runRef.current) return;
          const message = err?.response?.data?.message || t("live.e.hFail");
          setHarakatResults((r) => ({ ...r, [forAyah]: { state: "error", message } }));
        });
    });
  }

  function finishAyah(consumed) {
    submitHarakat(ayahNumber);
    const fin = finalizeLive(liveRef.current);
    setHistory((h) => [...h, { ayahNumber, score: fin.score, problems: fin.problems }]);
    setOffset((o) => o + consumed);
    if (ayahNumber >= ayahs.length) { stop(); setFinished(true); } else { setAyahNumber(ayahNumber + 1); }
  }

  // Auto-next: a short pause after the last word, so the reciter can see the result.
  useEffect(() => {
    if (!autoNext || !listening || finished || !live?.done) return undefined;
    const id = setTimeout(() => finishAyah(liveRef.current?.doneAt || 0), 450);
    return () => clearTimeout(id);
  }, [autoNext, listening, finished, live?.done, ayahNumber]);

  function chooseAyah(n) {
    if (recordingRef.current) recorder.cut(false); // throw away the piece recorded so far
    setAyahNumber(n); setOffset(heardWords.length); setHistory([]); setFinished(false);
  }

  const problemWords = live ? live.words.filter((w) => ["different", "missed", "close"].includes(w.status)) : [];
  const realCount = live ? live.words.filter((w) => w.status !== "neutral").length : 0;
  const reached = live ? live.words.filter((w, i) => ["match", "close", "missed"].includes(w.status) || (w.status === "different" && i !== live.current)).length : 0;
  const average = history.length ? Math.round(history.reduce((s, h) => s + h.score, 0) / history.length) : 0;

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-display text-noor-goldBright mb-2">{t("live.title")}</h1>
      <p className="text-noor-textMuted mb-4">{t("live.subtitle")}</p>

      <div role="note" className="glass-card p-4 mb-6 text-sm text-noor-textMuted space-y-1 border-amber-400/40">
        <p><strong className="text-amber-300">{t("rec.warnTitle")}</strong> {t("live.warn1")}</p>
        <p><strong className="text-amber-300">{t("live.warn2t")}</strong> {t("live.warn2")}</p>
        <p>{t("live.warn3")} <Link to="/privacy" className="text-noor-goldBright">{t("live.privacy")}</Link>).</p>
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
            <span className="block text-noor-textMuted mb-1">{t("live.startFrom")}</span>
            <select value={ayahNumber} disabled={!surah} onChange={(e) => chooseAyah(Number(e.target.value))}
              className="w-full rounded-lg bg-noor-surface2 border border-noor-border px-3 py-2 disabled:opacity-50">
              {(surah ? ayahs : [{ numberInSurah: 1 }]).map((a) => <option key={a.numberInSurah} value={a.numberInSurah}>{t("common.ayahN", { n: a.numberInSurah })}</option>)}
            </select>
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={autoNext} onChange={(e) => setAutoNext(e.target.checked)} />
          {t("live.autoNext")}
        </label>
        <div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={alertOn} onChange={(e) => { setAlertOn(e.target.checked); saveAlertPref(e.target.checked); }} />
            <BellRing size={16} aria-hidden="true" /> {t("live.alertSound")}
          </label>
          <p className="text-xs text-noor-textMuted mt-1">
            {t("live.alertHelp")}{" "}
            <button type="button" onClick={() => { unlockSound(); mistakeSound.wrong(); }} className="underline text-noor-goldBright">{t("live.testSound")}</button>
          </p>
        </div>
        {harakatEnabled === false && (
          <p className="text-xs text-noor-textMuted">{t("live.noServer")}</p>
        )}
        {harakatEnabled === true && !user && (
          <p className="text-xs text-noor-textMuted">{t("live.needAccount")} <Link to="/login" className="text-noor-goldBright">{t("nav.login")}</Link> {t("live.loginToUse")}</p>
        )}
        {harakatEnabled === true && user && !RECORDING_SUPPORTED && (
          <p className="text-xs text-noor-textMuted">{t("live.noRecord")}</p>
        )}
        {harakatEnabled === true && user && RECORDING_SUPPORTED && (
          <div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={harakatOn} disabled={listening} onChange={(e) => { setHarakatOn(e.target.checked); try { localStorage.setItem("siraj.harakatOn", e.target.checked ? "on" : "off"); } catch (err) { /* ignore */ } }} />
              {t("live.alsoCheck")}
            </label>
            <p className="text-xs text-noor-textMuted mt-1">{t("live.alsoCheckHelp")}</p>
          </div>
        )}
        {harakatNote && <p role="alert" className="text-xs text-amber-300">{harakatNote}</p>}
      </GlassCard>

      {loadError && <ErrorState message={t("rec.loadError")} onRetry={loadSurah} />}
      {!surah && !loadError && <SkeletonCard />}

      {surah && (
        <div className="flex flex-wrap items-center gap-3 mb-6">
          {!listening ? (
            <button onClick={start} disabled={!SpeechRecognition || finished}
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-noor-gold text-noor-onAccent font-medium disabled:opacity-40">
              <Mic size={18} aria-hidden="true" /> {t("rec.start")}
            </button>
          ) : (
            <button onClick={stop} className="flex items-center gap-2 px-6 py-3 rounded-full bg-red-500 text-white font-medium">
              <Square size={16} aria-hidden="true" /> {t("rec.stop")}
            </button>
          )}
          <button onClick={() => { if (recordingRef.current) recorder.cut(false); setOffset(heardWords.length); }} disabled={!target}
            className="flex items-center gap-2 px-4 py-3 rounded-full border border-noor-border text-sm disabled:opacity-40">
            <Repeat size={16} aria-hidden="true" /> {t("live.tryAgain")}
          </button>
          <button onClick={hardReset} className="flex items-center gap-2 px-4 py-3 rounded-full border border-noor-border text-sm">
            <RotateCcw size={16} aria-hidden="true" /> {t("live.startOver")}
          </button>
          <button onClick={playReference} disabled={!target || listening} title={listening ? t("live.stopFirst") : undefined}
            className="flex items-center gap-2 px-4 py-3 rounded-full border border-noor-border text-sm disabled:opacity-40">
            <Volume2 size={16} aria-hidden="true" /> {playing ? t("live.stopAudio") : t("live.listenAyah")}
          </button>
          <button onClick={detectNow}
            className="flex items-center gap-2 px-4 py-3 rounded-full border border-noor-border text-sm">
            <Search size={16} aria-hidden="true" /> {t("live.whichAyah")}
          </button>
          {listening && <span role="status" className="text-sm text-emerald-400 animate-pulse">{t("rec.listening")}</span>}
        </div>
      )}
      {micError && <p role="alert" className="text-sm text-red-400 mb-4">{micError}</p>}
      {audioError && <p role="alert" className="text-sm text-red-400 mb-4">{audioError}</p>}

      {detected && (
        <GlassCard className="mb-6 space-y-3" role="status">
          {detected.tooFew ? (
            <p className="text-sm text-noor-textMuted">{t("live.minWords", { n: MIN_WORDS })}. {t("live.minWordsHow")}</p>
          ) : detected.none ? (
            <>
              <p className="text-sm text-noor-textMuted">{t("live.noMatch", { surah: surah ? sName(surah) : "" })}</p>
              {wide?.state === "loading" && <p className="text-xs text-noor-textMuted animate-pulse">{t("live.wideSearching")}</p>}
              {wide?.state === "error" && <p className="text-xs text-amber-400">{t("live.wideError")}</p>}
              {wide?.state === "done" && wide.results.length === 0 && <p className="text-xs text-noor-textMuted">{t("live.wideNone")}</p>}
              {wide?.state === "done" && wide.results.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-noor-textMuted">{t("live.wideFound")}</p>
                  {wide.results.map((r) => (
                    <Link key={`${r.surahNumber}:${r.ayahNumber}`} to={`/quran/${r.surahNumber}?ayah=${r.ayahNumber}`} className="block rounded-lg border border-noor-border p-3 hover:border-noor-gold">
                      <span className="text-xs text-noor-goldBright">{lang === "en" ? r.surahName : (r.surahArabicName || r.surahName)} {r.surahNumber}:{r.ayahNumber}</span>
                      <span dir="rtl" lang="ar" className="block font-arabic text-lg leading-loose text-right mt-1">{String(r.text || "").replace(/<[^>]+>/g, "")}</span>
                    </Link>
                  ))}
                </div>
              )}
            </>
          ) : (            <>
              <p className="text-sm">
                {detected.ambiguous
                  ? t("live.ambiguous")
                  : detected.confidence === "high" ? t("live.looksLike") : t("live.mightBe")}
              </p>
              <div className="flex flex-wrap gap-2">
                {detected.candidates.map((c) => (
                  <button key={c.ayahNumber} onClick={() => jumpTo(c.ayahNumber)} className="px-4 py-2 rounded-full border border-noor-gold text-noor-goldBright text-sm">
                    {c.ayahNumber === ayahNumber ? t("live.goToCurrent", { n: c.ayahNumber }) : t("live.goTo", { n: c.ayahNumber })}
                  </button>
                ))}
              </div>
              <p className="text-xs text-noor-textMuted">{t("live.suggestion")}</p>
            </>
          )}
          <button onClick={() => setDetected(null)} className="text-xs text-noor-textMuted underline">{t("qibla.close")}</button>
        </GlassCard>
      )}

      {surah && target && live && !finished && (
        <GlassCard className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-noor-textMuted">{t("live.position", { ref: `${sName(surah)} ${surah.number}:${target.numberInSurah}`, total: ayahs.length })}</p>
            <p className="text-xs text-noor-textMuted" aria-live="polite">{t("live.wordsDone", { n: reached, total: realCount })}</p>
          </div>
          <div dir="rtl" lang="ar" className="flex flex-wrap gap-2 mb-4">
            {live.words.map((w, i) => (
              <span key={`${i}-${flash[i] || 0}`} aria-current={i === live.current ? "step" : undefined}
                className={`font-arabic text-3xl leading-loose px-3 py-1 rounded-lg border transition-colors ${WORD_STYLE[w.status]} ${flash[i] ? "mistake-flash" : ""}`}>
                {w.word}
                {WORD_LABEL[w.status] && <span className="sr-only"> — {t(WORD_LABEL[w.status])}</span>}
                <span className="inline-block align-middle mx-1"><WordIcon status={w.status} /></span>
                {w.retried && <span className="text-xs text-amber-300 align-middle" title={t("live.corrected")}>↻</span>}
                {liveHarakat?.words?.[i]?.status === "harakat" && (
                  <span className="text-xs text-red-300 align-middle mx-1 font-sans" title={liveHarakat.words[i].diffs.map((d) => describeDiffT(t, d)).join("; ")}>
                    <X size={12} className="inline" aria-hidden="true" /> {t("live.zz")}<span className="sr-only"> — {t("live.zzSr")}</span>
                  </span>
                )}
              </span>
            ))}
          </div>

          {alertNote && <p role="alert" className="text-sm font-medium text-red-400 mb-3">{alertNote}</p>}

          <ul className="text-xs text-noor-textMuted flex flex-wrap gap-4 mb-3">
            <li className="flex items-center gap-1"><Check size={12} aria-hidden="true" /> {t("live.w.match")}</li>
            <li className="flex items-center gap-1"><AlertTriangle size={12} aria-hidden="true" /> {t("live.w.close")}</li>
            <li className="flex items-center gap-1"><X size={12} aria-hidden="true" /> {t("live.lg.different")}</li>
            <li className="flex items-center gap-1">↻ {t("live.lg.corrected")}</li>
          </ul>

          {problemWords.length > 0 && (
            <div className="border-t border-noor-border pt-3 mb-3">
              <p className="text-sm mb-2">{t("live.toCheck")}</p>
              <ul className="space-y-1 text-sm">
                {problemWords.map((w, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-2">
                    <span dir="rtl" lang="ar" className="font-arabic text-xl">{w.word}</span>
                    <span className="text-noor-textMuted">
                      {w.status === "missed" && t("live.p.missed")}
                      {w.status === "close" && <>{t("live.p.close")} <span dir="rtl" lang="ar" className="font-arabic">{w.heard}</span></>}
                      {w.status === "different" && <>{t("live.p.different")} <span dir="rtl" lang="ar" className="font-arabic">{w.heard}</span>. {t("live.p.again")}</>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {live.done && <p className="text-sm text-emerald-400 mb-3">{t("live.ayahDone")} <strong>{live.score}%</strong></p>}

          <div className="flex flex-wrap gap-3">
            <button onClick={() => finishAyah(live.done ? live.doneAt : heardWords.length - offset)}
              className="flex items-center gap-2 px-4 py-2 rounded-full border border-noor-gold text-noor-goldBright text-sm">
              <SkipForward size={16} aria-hidden="true" /> {live.done ? t("live.nextAyah") : t("live.finishAyah")}
            </button>
            <Link to={`/quran/${surah.number}?ayah=${target.numberInSurah}`} className="px-4 py-2 rounded-full border border-noor-border text-sm">{t("live.openReader")}</Link>
          </div>
        </GlassCard>
      )}

      <HarakatResultsCard results={harakatResults} />

      {(history.length > 0 || finished) && (
        <GlassCard>
          <h2 className="text-lg mb-2">{finished ? t("live.surahFinished", { surah: surah ? sName(surah) : "" }) : t("live.sessionSoFar")}</h2>
          <p className="text-sm text-noor-textMuted mb-3">{t("live.average")} <strong className="text-noor-goldBright">{average}%</strong> {t(history.length === 1 ? "live.overAyahs1" : "live.overAyahsN", { n: history.length })}</p>
          <ul className="text-sm space-y-1">
            {history.map((h, i) => (
              <li key={i} className="flex justify-between border-b border-noor-border/50 py-1">
                <span>Ayah {h.ayahNumber}</span>
                <span className="text-noor-textMuted">{h.score}% · {h.problems === 0 ? t("live.noWordsToCheck") : t(h.problems === 1 ? "live.wordToCheck1" : "live.wordToCheckN", { n: h.problems })}</span>
              </li>
            ))}
          </ul>
          {ayahsToRepeat(history).length > 0 && (
            <p className="text-sm text-noor-textMuted mt-3">{t("live.worthAgain", { list: ayahsToRepeat(history).join(", ") })}</p>
          )}
          <div className="border-t border-noor-border mt-4 pt-4 space-y-2">
            {user ? (
              <>
                <button onClick={saveSession} disabled={listening || saveState === "saving" || saveState === "saved"}
                  className="flex items-center gap-2 px-4 py-2 rounded-full border border-noor-gold text-noor-goldBright text-sm disabled:opacity-50">
                  <Save size={16} aria-hidden="true" /> {saveState === "saving" ? t("tasbeeh.saving") : saveState === "saved" ? `${t("common.saved")} ✓` : t("live.saveSession")}
                </button>
                {saveState === "saved" && <p role="status" className="text-xs text-emerald-400">{t("live.savedSee")} <Link to="/dashboard?tab=recitation" className="underline">{t("live.savedLink")}</Link>.</p>}
                {saveState === "error" && <p role="alert" className="text-xs text-red-400">{saveMessage}</p>}
                <p className="text-xs text-noor-textMuted">{t("live.savedNote")}</p>
              </>
            ) : (
              <p className="text-xs text-noor-textMuted"><Link to="/login" className="text-noor-goldBright">{t("nav.login")}</Link> {t("live.loginSaveTail")}</p>
            )}
          </div>
        </GlassCard>
      )}

      <p className="text-xs text-noor-textMuted mt-6">{t("live.preferWhole")} <Link to="/recitation" className="text-noor-goldBright">{t("rec.title")}</Link>.</p>
    </div>
  );
}
