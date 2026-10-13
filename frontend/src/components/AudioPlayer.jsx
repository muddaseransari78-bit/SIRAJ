import React, { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, SkipBack, SkipForward, Volume2, Repeat, Repeat1 } from "lucide-react";
import { fetchReciters, fetchSurahAudio } from "../services/quranService";
import { useI18n } from "../context/I18nContext";
import { audioList } from "../utils/ayahAudio";
import {
  SPEEDS, afterEnded, buildRangeTracks, buildSurahTracks, chunk, findTrackIndex, formatTime, nextRepeat, preloadTargets, uniqueSurahs,
} from "../utils/audioTracks";

const DEFAULT_RECITER = "ar.alafasy";
const SURAHS_AT_A_TIME = 6; // a Juz can touch many Surahs: ask the server for a few at a time
const WARM_AHEAD = 2;       // how many following Ayahs are downloaded in advance
// Lists already fetched during this visit: switching reciter back and forth, or reopening a Surah, is instant.
const audioListCache = new Map(); // "surah:reciter" -> [{ numberInSurah, audio }]
let recitersCache = null;         // the reciter dropdown

async function loadSurahAudio(surah, reciter) {
  const key = `${surah}:${reciter}`;
  if (audioListCache.has(key)) return audioListCache.get(key);
  let lastError = new Error("no audio");
  for (let attempt = 0; attempt < 2; attempt += 1) { // one quiet retry for a slow / dropped request
    try {
      const list = audioList(await fetchSurahAudio(surah, reciter));
      if (list.length) { audioListCache.set(key, list); return list; }
    } catch (e) { lastError = e; }
  }
  throw lastError;
}

/**
 * Ayah-by-ayah Quran audio player. One player for EVERY Quran view:
 *  - <AudioPlayer surahNumber={2} />             a whole Surah
 *  - <AudioPlayer ayahs={range.ayahs} />         a Juz / Page / Hizb / Ruku (can span several Surahs)
 * Props:
 *  - onAyahChange(numberInSurah | null, surahNumber): lets the page highlight the Ayah being recited
 *  - startRequest: { n, s?, t } - when this object changes, playback jumps to Ayah n (of Surah s)
 *  - autoStart: start playing as soon as the audio is ready (the browser may ask for one tap)
 *
 * Phase 39 - smooth playback:
 *  - the next Ayahs are downloaded while the current one plays, and the next Ayah is started in the same
 *    moment the last one ends (no waiting for a screen refresh), so there is no pause between Ayahs;
 *  - changing the reciter keeps the current Ayah playing until the new recitation is ready, then continues
 *    from the same Ayah (it no longer stops, empties the player and reloads);
 *  - audio lists are remembered, a failed download is retried, and a broken file is skipped while playing on.
 */
export default function AudioPlayer({ surahNumber, ayahs, onAyahChange, startRequest, autoStart = false }) {
  const { t } = useI18n();
  const audioRef = useRef(null);
  const [reciters, setReciters] = useState([]);
  const [reciter, setReciter] = useState(() => { try { return localStorage.getItem("siraj_reciter") || DEFAULT_RECITER; } catch (e) { return DEFAULT_RECITER; } });
  const [speed, setSpeed] = useState(() => {
    let saved = 0;
    try { saved = Number(localStorage.getItem("siraj_audio_speed")); } catch (e) { /* ignore */ }
    return SPEEDS.includes(saved) ? saved : 1;
  });
  const [tracks, setTracks] = useState([]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);     // first load of a Surah / range (nothing to play yet)
  const [switching, setSwitching] = useState(false); // a new reciter is being fetched while the old one keeps playing
  const [buffering, setBuffering] = useState(false); // the file is still arriving
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [time, setTime] = useState({ now: 0, total: 0 });
  const [repeat, setRepeat] = useState("off"); // "off" | "ayah" | "all"
  const shouldAutoplay = useRef(false);
  const resumeAt = useRef(null);       // keeps your place when only the reciter changes
  const wasPlaying = useRef(false);    // was it playing when the reciter was changed
  const prevReciter = useRef(reciter); // last reciter that loaded fine (we go back to it if the new one fails)
  const autoStartedFor = useRef(null);
  const tracksRef = useRef([]);
  const urlRef = useRef("");           // link currently loaded in the <audio> element
  const retryRef = useRef(0);          // quiet retries of a broken file
  const handledRequest = useRef(null); // the startRequest that was already carried out
  const warm = useRef(new Map());      // url -> Audio element downloading in advance
  tracksRef.current = tracks;

  const isRange = Array.isArray(ayahs);
  const surahList = useMemo(() => (isRange ? uniqueSurahs(ayahs) : [surahNumber]), [isRange, ayahs, surahNumber]);
  const sourceKey = isRange
    ? `range:${ayahs.length}:${ayahs[0]?.globalAyahNumber}:${ayahs[ayahs.length - 1]?.globalAyahNumber}`
    : `surah:${surahNumber}`;

  // Reciter list (Arabic reciters only, to keep the dropdown short)
  useEffect(() => {
    if (recitersCache) { setReciters(recitersCache); return; }
    fetchReciters()
      .then((list) => { recitersCache = list.filter((r) => r.language === "ar"); setReciters(recitersCache); })
      .catch(() => {});
  }, []);

  // Leaving the page: stop the sound and drop the downloads in advance
  useEffect(() => () => {
    const el = audioRef.current;
    if (el) { try { el.pause(); } catch (e) { /* ignore */ } }
    warm.current.forEach((a) => { try { a.removeAttribute("src"); a.load(); } catch (e) { /* ignore */ } });
    warm.current.clear();
  }, []);

  function startPlay(el) {
    const p = el.play();
    if (p && typeof p.then === "function") {
      p.then(() => { setPlaying(true); setNote(""); })
        .catch((e) => {
          if (e && e.name === "AbortError") return; // a newer Ayah replaced this one: not a problem
          setPlaying(false); setNote(t("audio.tapPlay"));
        });
    }
  }

  // Download the next Ayahs now, so they start at once when their turn comes
  function warmAhead(list, i) {
    for (const url of preloadTargets(list, i, WARM_AHEAD)) {
      if (warm.current.has(url)) continue;
      try { const a = new Audio(); a.preload = "auto"; a.src = url; warm.current.set(url, a); } catch (e) { /* ignore */ }
    }
    while (warm.current.size > 6) {
      const [oldUrl, oldAudio] = warm.current.entries().next().value;
      try { oldAudio.removeAttribute("src"); oldAudio.load(); } catch (e) { /* ignore */ }
      warm.current.delete(oldUrl);
    }
  }

  // Load the audio list whenever the Surah / range or the reciter changes
  useEffect(() => {
    let cancelled = false;
    const wanted = resumeAt.current;
    const keepPlaying = Boolean(wanted) && wasPlaying.current;
    resumeAt.current = null;
    const isSwitch = Boolean(wanted) && tracksRef.current.length > 0; // same Surah, only the reciter changed
    setError(""); setNote("");
    if (isSwitch) {
      setSwitching(true); // the old recitation keeps playing until the new one is ready
    } else {
      const el = audioRef.current;
      if (el) { try { el.pause(); } catch (e) { /* ignore */ } }
      urlRef.current = "";
      setLoading(true); setPlaying(false); setTracks([]); setIndex(0); setTime({ now: 0, total: 0 });
      onAyahChange?.(null);
    }

    (async () => {
      const bySurah = {};
      let failed = 0;
      for (const group of chunk(surahList, SURAHS_AT_A_TIME)) {
        const results = await Promise.allSettled(group.map((s) => loadSurahAudio(s, reciter)));
        if (cancelled) return;
        results.forEach((r, i) => {
          if (r.status === "fulfilled") bySurah[group[i]] = r.value;
          else failed += 1;
        });
      }
      const list = isRange ? buildRangeTracks(ayahs, bySurah) : buildSurahTracks(surahNumber, bySurah[surahNumber]);
      if (list.length === 0) {
        if (isSwitch && prevReciter.current !== reciter) {
          // the new reciter has no audio for this Surah: go back to the one that was playing
          resumeAt.current = wanted; wasPlaying.current = keepPlaying;
          try { localStorage.setItem("siraj_reciter", prevReciter.current); } catch (e) { /* ignore */ }
          setReciter(prevReciter.current);
          setNote(t("audio.reciterFail"));
          return;
        }
        setError(t("audio.loadError"));
        return;
      }
      prevReciter.current = reciter;
      if (failed > 0) setNote(t("audio.partial"));
      let start = wanted ? findTrackIndex(list, wanted.s, wanted.n) : 0;
      if (start < 0) start = 0;
      if (isSwitch) shouldAutoplay.current = keepPlaying;
      else if (autoStart && autoStartedFor.current !== sourceKey) { autoStartedFor.current = sourceKey; shouldAutoplay.current = true; }
      setIndex(start);
      setTracks(list);
    })()
      .catch(() => { if (!cancelled) setError(t("audio.loadError")); })
      .finally(() => { if (!cancelled) { setLoading(false); setSwitching(false); } });

    return () => { cancelled = true; };
  }, [sourceKey, reciter]);

  // Point the <audio> element at the current track (only when the link really changed)
  useEffect(() => {
    const el = audioRef.current;
    const track = tracks[index];
    if (!el || !track) return;
    onAyahChange?.(track.numberInSurah, track.surahNumber);
    if (urlRef.current !== track.audio) {
      urlRef.current = track.audio; retryRef.current = 0;
      el.src = track.audio;
      el.defaultPlaybackRate = speed; el.playbackRate = speed;
      if (shouldAutoplay.current) startPlay(el);
    }
    warmAhead(tracks, index);
  }, [tracks, index]);

  // Playback speed
  useEffect(() => {
    const el = audioRef.current;
    if (el) { el.defaultPlaybackRate = speed; el.playbackRate = speed; }
    try { localStorage.setItem("siraj_audio_speed", String(speed)); } catch (e) { /* ignore */ }
  }, [speed]);

  // Move to a track and (optionally) play it. The source is switched RIGHT HERE, in the same moment, not after a re-render.
  function goTo(i, autoplay) {
    const el = audioRef.current;
    const track = tracks[i];
    if (!el || !track) return;
    shouldAutoplay.current = autoplay;
    setIndex(i);
    if (urlRef.current !== track.audio) {
      urlRef.current = track.audio; retryRef.current = 0;
      el.src = track.audio;
      el.defaultPlaybackRate = speed; el.playbackRate = speed;
    } else {
      el.currentTime = 0;
    }
    if (autoplay) startPlay(el);
  }

  // Jump to a requested Ayah (from a "Play" button or a tap in the Mushaf text). Each request is carried out once only.
  useEffect(() => {
    if (!startRequest || !tracks.length || handledRequest.current === startRequest) return;
    const i = findTrackIndex(tracks, startRequest.s ?? surahNumber, startRequest.n);
    if (i >= 0) { handledRequest.current = startRequest; goTo(i, true); }
  }, [startRequest, tracks]);

  function toggle() {
    const el = audioRef.current;
    if (!el || !tracks.length) return;
    if (playing) { el.pause(); setPlaying(false); shouldAutoplay.current = false; }
    else {
      shouldAutoplay.current = true;
      setNote(""); setError("");
      const p = el.play();
      if (p && typeof p.then === "function") p.then(() => setPlaying(true)).catch((e) => { if (!e || e.name !== "AbortError") setError(t("audio.blocked")); });
    }
  }

  function step(delta) {
    const next = index + delta;
    if (next >= 0 && next < tracks.length) goTo(next, playing || shouldAutoplay.current);
  }

  function handleEnded() {
    const action = afterEnded(repeat, index, tracks.length);
    const el = audioRef.current;
    if (action === "replay") { if (el) { el.currentTime = 0; startPlay(el); } return; }
    if (action === "next") { goTo(index + 1, true); return; }
    if (action === "restart") { goTo(0, true); return; }
    setPlaying(false); shouldAutoplay.current = false; onAyahChange?.(null);
  }

  // A file failed: try again quietly (twice); if it still fails while playing on, skip to the next Ayah
  function handleElError() {
    const el = audioRef.current;
    const track = tracks[index];
    if (!el || !track || !urlRef.current) return;
    if (retryRef.current < 2) {
      retryRef.current += 1;
      el.src = track.audio; el.load();
      if (shouldAutoplay.current) startPlay(el);
      return;
    }
    if (shouldAutoplay.current && index + 1 < tracks.length) { goTo(index + 1, true); setNote(t("audio.skipped")); return; }
    setBuffering(false); setPlaying(false); setError(t("audio.fileError"));
  }

  function changeReciter(e) {
    const current = tracks[index];
    resumeAt.current = current ? { s: current.surahNumber, n: current.numberInSurah } : null;
    wasPlaying.current = playing || shouldAutoplay.current;
    try { localStorage.setItem("siraj_reciter", e.target.value); } catch (err) { /* ignore */ }
    setReciter(e.target.value);
  }

  function seek(e) {
    const el = audioRef.current;
    if (el) el.currentTime = Number(e.target.value);
  }

  const syncTime = () => {
    const el = audioRef.current;
    if (el) setTime({ now: el.currentTime || 0, total: Number.isFinite(el.duration) ? el.duration : 0 });
  };

  // Lock screen / headset buttons (phones): play, pause, next and previous Ayah
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator) || !tracks[index]) return undefined;
    try {
      const cur = tracks[index];
      if (typeof window.MediaMetadata === "function") {
        navigator.mediaSession.metadata = new window.MediaMetadata({ title: `${cur.surahNumber}:${cur.numberInSurah}`, artist: "SIRAJ" });
      }
      navigator.mediaSession.setActionHandler("play", () => { const el = audioRef.current; if (el) { shouldAutoplay.current = true; startPlay(el); } });
      navigator.mediaSession.setActionHandler("pause", () => { const el = audioRef.current; if (el) { el.pause(); shouldAutoplay.current = false; } });
      navigator.mediaSession.setActionHandler("nexttrack", () => step(1));
      navigator.mediaSession.setActionHandler("previoustrack", () => step(-1));
    } catch (e) { /* not supported */ }
    return undefined;
  }, [tracks, index, playing]);

  const current = tracks[index];
  const repeatTitle = repeat === "off" ? t("audio.repeatOff") : repeat === "ayah" ? t("audio.repeatAyah") : t("audio.repeatAll");

  return (
    <div className="fixed bottom-16 lg:bottom-4 left-0 right-0 z-30 px-4">
      <div className="max-w-3xl mx-auto glass-card px-4 py-3 shadow-glow space-y-2">
        <audio
          ref={audioRef} onEnded={handleEnded} onPause={() => setPlaying(false)} onPlay={() => setPlaying(true)}
          onTimeUpdate={syncTime} onLoadedMetadata={syncTime}
          onWaiting={() => setBuffering(true)} onStalled={() => setBuffering(true)}
          onPlaying={() => { setBuffering(false); setPlaying(true); setError(""); retryRef.current = 0; }}
          onCanPlay={() => setBuffering(false)}
          onError={handleElError} preload="auto"
        />
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2" dir="ltr">
            <button onClick={() => step(-1)} disabled={!tracks.length || index === 0} aria-label={t("audio.prev")} className="p-2 rounded-full hover:bg-noor-surface2 disabled:opacity-40"><SkipBack size={18} /></button>
            <button onClick={toggle} disabled={!tracks.length} aria-label={playing ? t("audio.pause") : t("ayah.play")} className="p-3 rounded-full bg-noor-gold text-noor-onAccent disabled:opacity-40">
              {playing ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <button onClick={() => step(1)} disabled={!tracks.length || index >= tracks.length - 1} aria-label={t("audio.next")} className="p-2 rounded-full hover:bg-noor-surface2 disabled:opacity-40"><SkipForward size={18} /></button>
          </div>
          <div className="text-xs text-noor-textMuted flex-1 min-w-[120px]" role="status">
            {loading && t("audio.loading")}
            {!loading && error && <span className="text-red-400">{error}</span>}
            {!loading && !error && current && (
              <>
                {(switching || buffering) && <span className="block text-noor-goldBright animate-pulse">{switching ? t("audio.switching") : t("audio.buffering")}</span>}
                <span dir="ltr">{isRange ? t("audio.nowPlaying", { ref: `${current.surahNumber}:${current.numberInSurah}`, i: index + 1, m: tracks.length }) : t("audio.ayahOf", { n: current.numberInSurah, m: tracks.length })}</span>
                {note && <span className="block text-amber-400">{note}</span>}
              </>
            )}
          </div>
          <button
            onClick={() => setRepeat(nextRepeat)} aria-label={`${t("audio.repeat")}: ${repeatTitle}`} title={repeatTitle}
            className={`p-2 rounded-full ${repeat === "off" ? "text-noor-textMuted hover:bg-noor-surface2" : "bg-noor-surface2 text-noor-goldBright"}`}
          >
            {repeat === "ayah" ? <Repeat1 size={18} /> : <Repeat size={18} />}
          </button>
          <label className="flex items-center gap-1 text-xs text-noor-textMuted">
            <span className="sr-only">{t("audio.speed")}</span>
            <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} aria-label={t("audio.speed")} title={t("audio.speed")}
              className="rounded-lg bg-noor-surface2 border border-noor-border px-2 py-1 text-xs" dir="ltr">
              {SPEEDS.map((s) => <option key={s} value={s}>{s}x</option>)}
            </select>
          </label>
          <div className="flex items-center gap-2">
            <Volume2 size={16} className="text-noor-textMuted" aria-hidden="true" />
            <select value={reciter} onChange={changeReciter} aria-label={t("audio.reciter")}
              className="max-w-[170px] rounded-lg bg-noor-surface2 border border-noor-border px-2 py-1 text-xs">
              {reciters.length === 0 && <option value={reciter}>{reciter}</option>}
              {reciters.map((r) => <option key={r.identifier} value={r.identifier}>{r.englishName}</option>)}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-noor-textMuted" dir="ltr">
          <span className="w-9 text-end tabular-nums">{formatTime(time.now)}</span>
          <input
            type="range" min="0" max={Math.max(1, Math.floor(time.total))} step="1" value={Math.min(Math.floor(time.now), Math.max(1, Math.floor(time.total)))}
            onChange={seek} disabled={!current} aria-label={t("audio.seek")}
            className="flex-1 accent-noor-gold disabled:opacity-40"
          />
          <span className="w-9 tabular-nums">{formatTime(time.total)}</span>
        </div>
      </div>
    </div>
  );
}
