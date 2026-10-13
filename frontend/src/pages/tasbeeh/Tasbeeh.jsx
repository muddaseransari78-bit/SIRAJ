import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Minus, RotateCcw, Save, Trash2 } from "lucide-react";
import GlassCard from "../../components/GlassCard";
import { Boundary, webglAvailable } from "../../components/CompassView";
import { useAuth } from "../../context/AuthContext";
import { saveTasbeehSession, fetchTasbeehHistory, deleteTasbeehSession } from "../../services/contentService";
import { tasbeehSound } from "../../services/tasbeehSound";
import { localDate } from "../../utils/date";
import {
  CUSTOM_ID, DHIKR, MAX_COUNT, PRESET_TARGETS, addTap, clampTarget, dhikrLabel, litBeads, progressOf, resetCount, sanitizeState, undoTap,
} from "../../utils/tasbeeh";
import { currentlyLite } from "../../hooks/useLiteMode";
import { useI18n } from "../../context/I18nContext";

const TasbeehBeads3D = lazy(() => import("../../three/TasbeehBeads3D"));

const STATE_KEY = "siraj_tasbeeh";
const VIEW_KEY = "siraj_tasbeeh_view";
const pill = (on) => `px-3 py-1.5 rounded-full text-sm ${on ? "bg-noor-gold text-noor-onAccent" : "bg-noor-surface2"}`;

function loadState() {
  try { return sanitizeState(JSON.parse(localStorage.getItem(STATE_KEY) || "null"), localDate()); }
  catch (e) { return sanitizeState(null, localDate()); }
}

function defaultView() {
  const saved = localStorage.getItem(VIEW_KEY);
  if (saved === "3d" || saved === "flat") return saved;
  // Weak device / Data Saver / reduced motion / "Lite" choice in the footer -> flat view (see hooks/useLiteMode.js)
  return !currentlyLite() && webglAvailable() ? "3d" : "flat";
}

export default function Tasbeeh() {
  const { t, lang } = useI18n();
  const dhikrName = (d) => (lang === "en" ? d.en : t(`dhikr.${d.id}`));
  const { user } = useAuth();
  const [state, setState] = useState(loadState);
  const [view, setView] = useState(defaultView);
  const [targetInput, setTargetInput] = useState(() => (PRESET_TARGETS.includes(loadState().target) ? "" : String(loadState().target)));
  const [history, setHistory] = useState(null);
  const [historyError, setHistoryError] = useState(false);
  const [msg, setMsg] = useState("");
  const [announce, setAnnounce] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [saving, setSaving] = useState(false);
  const msgTimer = useRef(null);
  const resetTimer = useRef(null);

  const count = state.counts[state.dhikrId] || 0;
  const { rounds, inRound, pct, justCompleted } = progressOf(count, state.target);
  const current = state.dhikrId === CUSTOM_ID ? null : DHIKR.find((d) => d.id === state.dhikrId);

  // Remember everything on this device (so a page refresh does not lose the count)
  useEffect(() => {
    try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }, [state]);

  useEffect(() => () => { clearTimeout(msgTimer.current); clearTimeout(resetTimer.current); }, []);

  function flash(text) {
    setMsg(text);
    clearTimeout(msgTimer.current);
    msgTimer.current = setTimeout(() => setMsg(""), 3500);
  }

  const loadHistory = useCallback(() => {
    if (!user) { setHistory(null); return; }
    setHistoryError(false);
    fetchTasbeehHistory().then(setHistory).catch(() => setHistoryError(true));
  }, [user]);
  useEffect(() => { loadHistory(); }, [loadHistory]);

  // ----- counting -----
  function tap() {
    if (count >= MAX_COUNT) { flash(t("tasbeeh.max")); return; }
    const next = count + 1;
    const done = next % state.target === 0;
    setState((s) => addTap(s, localDate()));
    if (state.vibrate && navigator.vibrate) navigator.vibrate(done ? [80, 40, 80] : 15);
    if (state.sound) (done ? tasbeehSound.chime : tasbeehSound.tick)();
    if (done) setAnnounce(t("tasbeeh.roundDone", { n: Math.floor(next / state.target), total: next }));
  }

  function undo() {
    setState((s) => undoTap(s, localDate()));
    setAnnounce("");
  }

  function reset() {
    if (count === 0) return;
    if (!confirmReset) { // ask once, so one accidental tap does not delete a long count
      setConfirmReset(true);
      clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => setConfirmReset(false), 3000);
      return;
    }
    clearTimeout(resetTimer.current);
    setConfirmReset(false);
    setState((s) => resetCount(s));
    setAnnounce(t("tasbeeh.resetDone"));
  }

  function chooseDhikr(id) { setState((s) => ({ ...s, dhikrId: id })); setConfirmReset(false); }

  function chooseTarget(n) {
    setState((s) => ({ ...s, target: n }));
    setTargetInput(PRESET_TARGETS.includes(n) ? "" : String(n));
  }

  function applyCustomTarget(e) {
    if (e) e.preventDefault();
    if (targetInput.trim() === "") return;
    const n = clampTarget(targetInput, state.target);
    chooseTarget(n);
    setTargetInput(PRESET_TARGETS.includes(n) ? "" : String(n));
  }

  function switchView() {
    const next = view === "3d" ? "flat" : "3d";
    setView(next);
    try { localStorage.setItem(VIEW_KEY, next); } catch (e) { /* ignore */ }
  }

  // ----- saving to the account -----
  async function save() {
    if (!user) { flash(t("tasbeeh.loginSave")); return; }
    if (count < 1 || saving) return;
    setSaving(true);
    try {
      await saveTasbeehSession({ dhikr: dhikrLabel(state), count, target: state.target });
      setState((s) => resetCount(s));
      flash(t("tasbeeh.saved"));
      loadHistory();
    } catch (e) {
      flash(e.response?.data?.message || t("tasbeeh.saveFail"));
    } finally { setSaving(false); }
  }

  async function removeSession(id) {
    try { await deleteTasbeehSession(id); loadHistory(); }
    catch (e) { flash(t("tasbeeh.delFail")); }
  }

  const maxBar = history ? Math.max(1, ...history.last7.map((d) => d.total)) : 1;
  const flatDial = (
    <div className="absolute inset-0 rounded-full"
      style={{ background: `conic-gradient(rgb(var(--noor-goldBright)) ${pct}%, rgb(var(--noor-surface2)) 0)`, boxShadow: "0 20px 40px rgb(0 0 0 / .35), 0 0 50px rgb(var(--noor-goldBright) / .2)" }} />
  );

  return (
    <div className="max-w-xl mx-auto px-4 py-12 text-center">
      <h1 className="text-3xl font-display text-noor-goldBright mb-6">{t("tasbeeh.title")}</h1>

      <div className="flex flex-wrap gap-2 justify-center mb-3" role="group" aria-label={t("tasbeeh.choose")}>
        {DHIKR.map((d) => (
          <button key={d.id} onClick={() => chooseDhikr(d.id)} aria-pressed={state.dhikrId === d.id} className={pill(state.dhikrId === d.id)}>
            {dhikrName(d)}{state.counts[d.id] ? <span className="ms-1 opacity-70">({state.counts[d.id]})</span> : null}
          </button>
        ))}
        <button onClick={() => chooseDhikr(CUSTOM_ID)} aria-pressed={state.dhikrId === CUSTOM_ID} className={pill(state.dhikrId === CUSTOM_ID)}>{t("tasbeeh.own")}</button>
      </div>
      {state.dhikrId === CUSTOM_ID && (
        <div className="mb-3">
          <label htmlFor="own-dhikr" className="sr-only">{t("tasbeeh.ownLabel")}</label>
          <input id="own-dhikr" value={state.customText} maxLength={60} placeholder={t("tasbeeh.ownPh")}
            onChange={(e) => setState((s) => ({ ...s, customText: e.target.value }))}
            className="w-full max-w-sm rounded-full bg-noor-surface2 border border-noor-border px-4 py-2 text-sm text-center" />
        </div>
      )}

      <GlassCard className="shadow-glow">
        {current ? (
          <>
            <p dir="rtl" lang="ar" className="font-arabic text-3xl text-noor-goldBright mb-1">{current.ar}</p>
            <p className="text-sm text-noor-textMuted mb-4">{dhikrName(current)}</p>
          </>
        ) : (
          <p className="text-xl text-noor-goldBright mb-4 break-words">{state.customText.trim() || t("tasbeeh.ownLabel")}</p>
        )}

        {/* The big counter: a button on top, the 3D beads (or flat ring) behind it */}
        <div className="relative mx-auto w-64 h-64 sm:w-72 sm:h-72">
          {view === "3d" ? (
            <Boundary fallback={flatDial} onFail={() => setView("flat")}>
              <Suspense fallback={<div className="absolute inset-0 rounded-full bg-noor-surface2 animate-pulse" />}>
                <div className="absolute inset-0"><TasbeehBeads3D count={count} lit={litBeads(count, state.target)} /></div>
              </Suspense>
            </Boundary>
          ) : flatDial}
          {view !== "3d" && <span className="absolute inset-3 rounded-full bg-noor-surface" aria-hidden="true" />}
          <button onClick={tap}
            aria-label={t("tasbeeh.tapAria", { count, round: rounds + 1, inRound, target: state.target })}
            className="absolute inset-0 rounded-full flex flex-col items-center justify-center active:scale-95 transition-transform select-none touch-manipulation focus-visible:outline focus-visible:outline-2 focus-visible:outline-noor-goldBright"
            style={{ WebkitTapHighlightColor: "transparent" }}>
            <span className="text-6xl font-display text-noor-text leading-none">{count}</span>
            <span className="text-xs text-noor-textMuted mt-2">{t("tasbeeh.roundLine", { inRound, target: state.target, round: rounds + (justCompleted ? 0 : 1) })}</span>
            {rounds > 0 && <span className="text-xs text-noor-goldBright mt-0.5">{t(rounds === 1 ? "tasbeeh.roundsOne" : "tasbeeh.roundsMany", { n: rounds })}</span>}
          </button>
        </div>
        <p role="status" aria-live="polite" className="sr-only">{announce}</p>

        <div className="flex gap-3 justify-center mt-5">
          <button onClick={undo} disabled={count === 0} aria-label={t("tasbeeh.undoAria")} className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-noor-border text-sm disabled:opacity-40">
            <Minus size={14} aria-hidden="true" /> {t("tasbeeh.undo")}
          </button>
          <button onClick={reset} disabled={count === 0} className={`flex items-center gap-1.5 px-4 py-2 rounded-full border text-sm disabled:opacity-40 ${confirmReset ? "border-red-400 text-red-300" : "border-noor-border"}`}>
            <RotateCcw size={14} aria-hidden="true" /> {confirmReset ? t("tasbeeh.resetConfirm") : t("tasbeeh.reset")}
          </button>
          <button onClick={save} disabled={saving || count < 1} className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-noor-gold text-noor-onAccent font-medium text-sm disabled:opacity-50">
            <Save size={14} aria-hidden="true" /> {saving ? t("tasbeeh.saving") : t("tasbeeh.save")}
          </button>
        </div>
        {msg && <p role="status" className="text-sm text-noor-goldBright mt-3">{msg}</p>}

        <div className="mt-6 border-t border-noor-border pt-4">
          <p className="text-xs text-noor-textMuted mb-2">{t("tasbeeh.target")}</p>
          <div className="flex flex-wrap gap-2 justify-center items-center">
            {PRESET_TARGETS.map((n) => (
              <button key={n} onClick={() => chooseTarget(n)} aria-pressed={state.target === n}
                className={`px-3 py-1 rounded-full text-sm ${state.target === n ? "bg-noor-emerald text-noor-text" : "bg-noor-surface2"}`}>{n}</button>
            ))}
            <form onSubmit={applyCustomTarget} className="flex items-center gap-1">
              <label htmlFor="custom-target" className="sr-only">{t("tasbeeh.customTarget")}</label>
              <input id="custom-target" value={targetInput} inputMode="numeric" maxLength={6} placeholder={t("tasbeeh.customPh")}
                onChange={(e) => setTargetInput(e.target.value.replace(/\D/g, ""))} onBlur={applyCustomTarget}
                className={`w-24 rounded-full px-3 py-1 text-sm text-center ${!PRESET_TARGETS.includes(state.target) ? "bg-noor-emerald text-noor-text" : "bg-noor-surface2"}`} />
              <button type="submit" className="px-3 py-1 rounded-full bg-noor-surface2 text-sm">{t("tasbeeh.set")}</button>
            </form>
          </div>
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-2 justify-center mt-4 text-xs text-noor-textMuted">
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={state.vibrate} onChange={(e) => setState((s) => ({ ...s, vibrate: e.target.checked }))} /> {t("tasbeeh.vibration")}{!navigator.vibrate && ` ${t("tasbeeh.noVibrate")}`}</label>
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={state.sound} onChange={(e) => { const on = e.target.checked; setState((s) => ({ ...s, sound: on })); if (on) tasbeehSound.tick(); }} /> {t("tasbeeh.sound")}</label>
          <button onClick={switchView} className="underline">{view === "3d" ? t("qibla.simpleView") : t("qibla.view3d")}</button>
        </div>
      </GlassCard>

      <p className="text-sm text-noor-textMuted mt-5">
        {t("tasbeeh.today")} <span className="text-noor-goldBright font-medium">{state.daily.total}</span>
        <span className="block text-xs mt-1">{t("tasbeeh.remembered")}</span>
      </p>

      {user ? (
        <div className="mt-10 text-start">
          {historyError && (
            <p className="text-sm text-red-400">{t("tasbeeh.historyError")} <button onClick={loadHistory} className="underline">{t("search.tryAgain")}</button></p>
          )}
          {history && (
            <>
              <div className="grid grid-cols-3 gap-3 text-center">
                <GlassCard className="p-4"><p className="text-xs text-noor-textMuted">{t("tasbeeh.savedToday")}</p><p className="text-2xl font-display text-noor-goldBright">{history.todayTotal}</p></GlassCard>
                <GlassCard className="p-4"><p className="text-xs text-noor-textMuted">{t("progress.last7")}</p><p className="text-2xl font-display">{history.last7.reduce((n, d) => n + d.total, 0)}</p></GlassCard>
                <GlassCard className="p-4"><p className="text-xs text-noor-textMuted">{t("tasbeeh.allTime")}</p><p className="text-2xl font-display">{history.allTimeTotal}</p></GlassCard>
              </div>

              <GlassCard className="mt-4">
                <h2 className="font-display text-lg mb-3">{t("progress.last7")}</h2>
                <div className="flex items-end gap-2 h-24">
                  {history.last7.map((d) => (
                    <div key={d.date} className="flex-1 flex flex-col items-center gap-1 h-full justify-end" title={`${d.date}: ${d.total}`}>
                      <div className="w-full bg-noor-gold/80 rounded-t" style={{ height: `${(d.total / maxBar) * 100}%`, minHeight: d.total ? 4 : 2, opacity: d.total ? 1 : 0.25 }} />
                      <span className="text-[10px] text-noor-textMuted">{d.date.slice(8)}</span>
                    </div>
                  ))}
                </div>
                {history.todayByDhikr.length > 0 && (
                  <p className="text-xs text-noor-textMuted mt-3">{t("tasbeeh.todayBy", { list: history.todayByDhikr.map((r) => `${r.dhikr} ${r.total}`).join(" • ") })}</p>
                )}
              </GlassCard>

              <h2 className="font-display text-lg mt-6 mb-2">{t("tasbeeh.sessions")}</h2>
              <ul className="space-y-2">
                {history.sessions.slice(0, 10).map((s) => (
                  <li key={s._id} className="glass-card px-4 py-2 flex items-center justify-between gap-3 text-sm">
                    <span className="truncate">{s.dhikr}</span>
                    <span className="flex items-center gap-3 shrink-0">
                      <span className="text-noor-textMuted">{s.count} • {s.date}</span>
                      <button onClick={() => removeSession(s._id)} aria-label={t("tasbeeh.deleteAria", { dhikr: s.dhikr, count: s.count })} className="text-noor-textMuted hover:text-red-400"><Trash2 size={14} /></button>
                    </span>
                  </li>
                ))}
                {history.sessions.length === 0 && <li className="text-noor-textMuted text-sm">{t("tasbeeh.noSessions")}</li>}
              </ul>
            </>
          )}
        </div>
      ) : (
        <p className="text-xs text-noor-textMuted mt-6"><Link to="/login" className="text-noor-goldBright">{t("nav.login")}</Link> {t("tasbeeh.loginTail")}</p>
      )}

      <p className="text-xs text-noor-textMuted mt-8">{t("tasbeeh.footnote")}</p>
    </div>
  );
}
