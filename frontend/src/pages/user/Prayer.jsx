import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, BellOff, Check, MapPin, Volume2, VolumeX, X } from "lucide-react";
import { loadPrayerTimes } from "../../services/prayerTimes";
import DailyDua from "../../components/DailyDua";
import GlassCard from "../../components/GlassCard";
import { ErrorState } from "../../components/Skeleton";
import { useAuth } from "../../context/AuthContext";
import usePrayerNotifications from "../../hooks/usePrayerNotifications";
import {
  fetchPrayerSettings, savePrayerSettings, fetchPrayerLog, setPrayerLog, fetchPrayerStats,
} from "../../services/contentService";
import {
  askPermission, adhanPlayer, currentPermission, notificationSupport, showPrayerNotification,
} from "../../services/prayerNotify";
import {
  PRAYERS, buildSchedule, fmt12, fmt12At, jamaatMoments, jamaatStatus, mergeSettings, nextPrayer, tuneFromSettings, withDefaults,
} from "../../utils/prayerSchedule";
import {
  currentSubscription, disablePush, enablePush, fetchPushKey, pushSupport, sendTestPush,
} from "../../services/webPush";
import { localDate, localDateDMY } from "../../utils/date";
import { saveCalc } from "../../utils/prayerCalc";
import { useI18n } from "../../context/I18nContext";

const ORDER = ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"];
const METHODS = [1, 3, 2, 4, 5, 15, 13, 8, 11].map((id) => ({ id, label: `method.${id}` }));
const BEFORE_OPTIONS = [5, 10, 15, 20, 30, 45, 60];
const ADJUST_OPTIONS = Array.from({ length: 21 }, (_, i) => i - 10); // -10 ... +10 minutes

const LOCAL_SETTINGS_KEY = "siraj_prayer_settings"; // used when nobody is logged in
const LOCATION_KEY = "siraj_location";              // manual city, remembered on this device

function readJSON(key) {
  try { return JSON.parse(localStorage.getItem(key) || "null"); } catch (e) { return null; }
}
function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignore */ }
}
function loadLocalSettings() {
  const saved = readJSON(LOCAL_SETTINGS_KEY) || {};
  const legacyMethod = Number(localStorage.getItem("siraj_method")) || undefined;
  return withDefaults({ ...(legacyMethod ? { method: legacyMethod } : {}), ...saved });
}
const pad = (n) => String(n).padStart(2, "0");
const clock = (t) => fmt12(t); // 12-hour text: "1:30 PM"
const hms = (ms) => `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor((ms % 3600000) / 60000))}:${pad(Math.floor((ms % 60000) / 1000))}`;

// One tap for Ahl-e-Sunnat (Hanafi) users: Karachi method, Hanafi Asr, Zuhar Jamaat 1:30 PM, Asr Jamaat 4:30 PM.
const AHL_E_SUNNAT_PRESET = {
  method: 1, school: 1, jamaatEnabled: true,
  jamaatMode: { Fajr: "off", Dhuhr: "fixed", Asr: "fixed", Maghrib: "off", Isha: "off" },
  jamaatTime: { Dhuhr: "13:30", Asr: "16:30" },
};
const JAMAAT_BEFORE_OPTIONS = [5, 10, 15, 20, 30];
const OFFSET_OPTIONS = [0, 5, 10, 15, 20, 25, 30, 40, 45, 60, 90];

const selectClass = "rounded-lg bg-noor-surface2 border border-noor-border px-2 py-1";

// A friendly on/off switch used in the alert settings
function Switch({ checked, onChange, disabled, label }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? "bg-noor-gold" : "bg-noor-surface2 border border-noor-border"} ${disabled ? "opacity-50" : ""}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "start-[1.375rem]" : "start-0.5"}`} />
    </button>
  );
}

// One line of the "will I get my alerts?" list
function StatusRow({ ok, label, note }) {
  return (
    <li className="flex items-start gap-2">
      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${ok ? "bg-emerald-600/80 text-white" : "bg-noor-surface2 text-noor-textMuted"}`} aria-hidden="true">
        {ok ? <Check size={13} /> : <X size={13} />}
      </span>
      <span className="min-w-0"><span className="block">{label}</span>{note && <span className="block text-xs text-noor-textMuted">{note}</span>}</span>
    </li>
  );
}

export default function Prayer() {
  const { user } = useAuth();
  const { t, lang, locale } = useI18n();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [reloadTick, setReloadTick] = useState(0);
  const [now, setNow] = useState(new Date());
  const [settings, setSettings] = useState(loadLocalSettings);
  const [saveError, setSaveError] = useState("");
  const [done, setDone] = useState({});
  const [stats, setStats] = useState(null);
  const [permission, setPermission] = useState(currentPermission());
  const [notifyMsg, setNotifyMsg] = useState("");
  const [adhanOn, setAdhanOn] = useState(adhanPlayer.isPlaying());
  const [testBusy, setTestBusy] = useState(false);
  // Background reminders (server push): "support" = this browser can, "serverReady" = the server has VAPID keys,
  // "subscribed" = this device is registered
  const [push, setPush] = useState({ support: pushSupport(), serverReady: false, subscribed: false, busy: false, msg: "" });

  // Location: browser location first; manual city when it is not allowed
  const [loc, setLoc] = useState(() => {
    const saved = readJSON(LOCATION_KEY);
    return saved && saved.city && saved.country ? { mode: "city", city: saved.city, country: saved.country } : null;
  });
  const [geoStatus, setGeoStatus] = useState("idle"); // idle | asking | ok | denied
  const [showCityForm, setShowCityForm] = useState(false);
  const [cityInput, setCityInput] = useState("");
  const [countryInput, setCountryInput] = useState("");

  const today = localDate(now);
  const tune = tuneFromSettings(settings);

  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => adhanPlayer.subscribe(setAdhanOn), []);
  useEffect(() => {
    const refresh = () => setPermission(currentPermission());
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);

  // ---------- location ----------
  function requestGeolocation() {
    if (!navigator.geolocation) { setGeoStatus("denied"); setShowCityForm(true); return; }
    setGeoStatus("asking");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        localStorage.removeItem(LOCATION_KEY);
        setLoc({ mode: "coords", lat: p.coords.latitude, lng: p.coords.longitude });
        setGeoStatus("ok");
        setShowCityForm(false);
      },
      () => { setGeoStatus("denied"); setShowCityForm(true); },
      { timeout: 15000, maximumAge: 10 * 60 * 1000 }
    );
  }

  useEffect(() => {
    if (!loc) requestGeolocation(); // a saved manual city skips the permission popup
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Not allowed + the account has a saved city -> use it
  useEffect(() => {
    if (geoStatus === "denied" && !loc && settings.city && settings.country) {
      setLoc({ mode: "city", city: settings.city, country: settings.country });
    }
  }, [geoStatus, loc, settings.city, settings.country]);

  function submitCity(e) {
    e.preventDefault();
    const city = cityInput.trim();
    const country = countryInput.trim();
    if (!city || !country) return;
    writeJSON(LOCATION_KEY, { city, country });
    setLoc({ mode: "city", city, country });
    setShowCityForm(false);
    updateSettings({ city, country });
  }

  // ---------- settings (account when logged in, this device otherwise) ----------
  useEffect(() => {
    if (!user) { setSettings(loadLocalSettings()); return; }
    fetchPrayerSettings().then((s) => setSettings(withDefaults(s))).catch(() => {});
    fetchPrayerStats(localDate()).then(setStats).catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchPrayerLog(today).then((r) => setDone(r.done)).catch(() => {});
  }, [user, today]);

  function updateSettings(patch) {
    const next = mergeSettings(settings, patch);
    setSettings(next);
    setSaveError("");
    if (patch.method !== undefined) localStorage.setItem("siraj_method", String(patch.method));
    if (patch.school !== undefined) localStorage.setItem("siraj_school", String(patch.school));
    if (user) {
      savePrayerSettings(patch).catch(() => setSaveError(t("pr.saveError")));
    } else {
      writeJSON(LOCAL_SETTINGS_KEY, next);
    }
  }

  // ---------- background reminders (server push) ----------
  const place = useMemo(() => {
    if (!loc) return null;
    return loc.mode === "city" ? { city: loc.city, country: loc.country } : { latitude: loc.lat, longitude: loc.lng };
  }, [loc]);

  useEffect(() => {
    if (!user || push.support !== "ok") return undefined;
    let cancelled = false;
    Promise.all([fetchPushKey().catch(() => ({ enabled: false })), currentSubscription()]).then(([key, sub]) => {
      if (!cancelled) setPush((p) => ({ ...p, serverReady: !!key.enabled, subscribed: !!sub }));
    });
    return () => { cancelled = true; };
  }, [user, push.support]);

  // The server needs to know where this device is (prayer times differ by place): send it again when it changes
  useEffect(() => {
    if (!user || !push.subscribed || !push.serverReady || !place || permission !== "granted") return;
    enablePush(place).then((r) => { if (!r.ok) setPush((p) => ({ ...p, msg: pushReason(r) })); });
  }, [user, push.subscribed, push.serverReady, place, permission]);

  // Reminders were switched on before the location was known (or before the server answered): finish turning on the
  // background reminders by themselves as soon as everything is ready, once per visit.
  const autoPush = useRef(false);
  useEffect(() => {
    if (autoPush.current) return;
    if (!user || !settings.notificationsEnabled || permission !== "granted") return;
    if (push.support !== "ok" || !push.serverReady || push.subscribed || !place) return;
    autoPush.current = true;
    enablePush(place).then((r) => setPush((p) => ({ ...p, subscribed: r.ok, msg: r.ok ? "" : pushReason(r) })));
  }, [user, settings.notificationsEnabled, permission, push.support, push.serverReady, push.subscribed, place]);

  // A new push address from the browser (rare) -> register it again
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return undefined;
    const onMessage = (e) => {
      if (e.data && e.data.type === "siraj-push-changed" && place) enablePush(place);
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [place]);

  async function turnOnPush() {
    setPush((p) => ({ ...p, busy: true, msg: "" }));
    let perm = permission;
    if (perm === "default") { perm = await askPermission(); setPermission(perm); }
    if (perm !== "granted") { setPush((p) => ({ ...p, busy: false, msg: t("pr.m.allowFirst") })); return; }
    const r = await enablePush(place);
    setPush((p) => ({ ...p, busy: false, subscribed: r.ok, msg: r.ok ? t("pr.m.bgOn") : pushReason(r) }));
  }
  async function turnOffPush() {
    setPush((p) => ({ ...p, busy: true, msg: "" }));
    await disablePush();
    setPush((p) => ({ ...p, busy: false, subscribed: false, msg: t("pr.m.bgOff") }));
  }
  // the browser-side helper returns a code: show the message in the page language
  const pushReason = (r) => (r && r.code && t(`pr.err.${r.code}`) !== `pr.err.${r.code}` ? t(`pr.err.${r.code}`) : (r && r.reason) || "");

  // Home and Ramadan use the same calculation as this page
  useEffect(() => { saveCalc(settings); }, [settings.method, settings.school, tune]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- prayer times ----------
  useEffect(() => {
    if (!loc) return undefined;
    let cancelled = false;
    setError("");
    const where = loc.mode === "city" ? { city: loc.city, country: loc.country } : { lat: loc.lat, lng: loc.lng };
    loadPrayerTimes({ ...where, method: settings.method, school: settings.school, tune: tune || undefined, date: localDateDMY(new Date()) }, settings.adjust)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => {
        if (cancelled) return;
        if (e.response && e.response.status === 404) { setError(e.response.data?.message || t("pr.notFound")); setShowCityForm(true); }
        else setError(t("pr.loadError"));
      });
    return () => { cancelled = true; };
  }, [loc, settings.method, settings.school, tune, today, reloadTick]);

  // ---------- reminders ----------
  const events = useMemo(() => (data ? buildSchedule(data, settings) : []), [data, settings]);
  const remindersActive = settings.notificationsEnabled && permission === "granted";
  const serverPush = !!user && push.subscribed && push.serverReady && permission === "granted";
  usePrayerNotifications(events, remindersActive, serverPush);
  const upcoming = remindersActive ? events.find((e) => e.fireAt > now.getTime()) : null;

  async function toggleNotifications() {
    if (settings.notificationsEnabled) { updateSettings({ notificationsEnabled: false }); return; }
    const support = notificationSupport();
    if (support === "unsupported") { setNotifyMsg(t("pr.m.unsupported")); return; }
    if (support === "insecure") { setNotifyMsg(t("pr.m.insecure")); return; }
    const perm = await askPermission();
    setPermission(perm);
    if (perm !== "granted") {
      setNotifyMsg(perm === "denied" ? t("pr.m.denied") : t("pr.m.notGranted"));
      return;
    }
    setNotifyMsg("");
    updateSettings({ notificationsEnabled: true });
    // Logged in + the server is ready: also switch on reminders that work when SIRAJ is closed
    if (user && push.support === "ok" && push.serverReady && place && !push.subscribed) {
      const r = await enablePush(place);
      setPush((p) => ({ ...p, subscribed: r.ok, msg: r.ok ? t("pr.m.bgOn") : pushReason(r) }));
    }
  }

  // One test button. With alerts-when-closed ON it waits 8 seconds so you can minimize or close the window first,
  // then the server sends the alert (a window that is still on screen shows it itself).
  async function sendTest() {
    if (testBusy) return;
    let perm = permission;
    if (perm === "default") { perm = await askPermission(); setPermission(perm); }
    if (perm !== "granted") { setNotifyMsg(perm === "denied" ? t("pr.m.denied") : t("pr.m.allowFirstOn")); return; }
    const local = () => showPrayerNotification({ title: t("pr.m.testTitle"), body: t("pr.m.testBody"), tag: "siraj-test" });
    setTestBusy(true);
    try {
      if (serverPush) {
        setNotifyMsg(t("pr.m.testCountdown"));
        await new Promise((resolve) => setTimeout(resolve, 8000));
        const r = await sendTestPush();
        if (document.visibilityState === "visible") await local(); // the worker skips a visible window
        setNotifyMsg(r.ok ? t("pr.m.testSentDone") : (r.reason || t("pr.m.testFail")));
      } else {
        const ok = await local();
        setNotifyMsg(ok ? t("pr.m.testOk") : t("pr.m.testFail"));
      }
    } finally { setTestBusy(false); }
  }

  // ---------- prayer log ----------
  async function toggleDone(name) {
    if (!user) return;
    const next = !done[name];
    setDone((d) => ({ ...d, [name]: next }));
    try {
      await setPrayerLog(name, next, today);
      fetchPrayerStats(today).then(setStats).catch(() => {});
    } catch (e) { setDone((d) => ({ ...d, [name]: !next })); }
  }

  const next = data ? nextPrayer(data, now.getTime()) : null;
  const diff = next ? Math.max(0, next.at - now.getTime()) : 0;
  const countdown = `${pad(Math.floor(diff / 3600000))}:${pad(Math.floor((diff % 3600000) / 60000))}:${pad(Math.floor((diff % 60000) / 1000))}`;
  const doneCount = PRAYERS.filter((p) => done[p]).length;
  const placeLabel = loc ? (loc.mode === "city" ? `${loc.city}, ${loc.country}` : t("pr.yourLoc")) : null;
  const anyAdjust = PRAYERS.some((p) => settings.adjust[p]);
  const jm = data ? jamaatMoments(data, settings) : {};
  const jStatus = data ? jamaatStatus(data, settings, now.getTime()) : { waiting: null, next: null };
  const jamaatText = (name) => (jm[name] ? fmt12At(jm[name].at, data.timezone) : null);

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-display text-noor-goldBright mb-2">{t("pr.title")}</h1>

      {/* Location line */}
      <div className="flex flex-wrap items-center gap-2 text-sm text-noor-textMuted mb-6">
        <MapPin size={14} aria-hidden="true" />
        <span>{geoStatus === "asking" && !loc ? t("pr.finding") : placeLabel || t("pr.noLoc")}</span>
        <button onClick={() => setShowCityForm((v) => !v)} className="text-noor-goldBright underline">
          {showCityForm ? t("qibla.close") : t("pr.change")}
        </button>
      </div>

      {showCityForm && (
        <GlassCard className="mb-6">
          {geoStatus === "denied" && (
            <p className="text-xs text-noor-textMuted mb-3">{t("pr.locUnavailable")}</p>
          )}
          <form onSubmit={submitCity} className="grid sm:grid-cols-2 gap-3 text-sm">
            <label className="flex flex-col gap-1">{t("pr.city")}
              <input value={cityInput} onChange={(e) => setCityInput(e.target.value)} maxLength={80} required placeholder={t("pr.cityPh")} className={selectClass} />
            </label>
            <label className="flex flex-col gap-1">{t("pr.country")}
              <input value={countryInput} onChange={(e) => setCountryInput(e.target.value)} maxLength={80} required placeholder={t("pr.countryPh")} className={selectClass} />
            </label>
            <div className="sm:col-span-2 flex flex-wrap gap-2">
              <button type="submit" className="px-4 py-2 rounded-full bg-noor-gold text-noor-onAccent font-medium">{t("pr.useCity")}</button>
              <button type="button" onClick={requestGeolocation} className="px-4 py-2 rounded-full border border-noor-border">{t("pr.useMyLoc")}</button>
            </div>
          </form>
        </GlassCard>
      )}

      {error && <ErrorState message={error} onRetry={() => setReloadTick((n) => n + 1)} />}
      {!data && !error && loc && <p className="text-noor-textMuted">{t("pr.loading")}</p>}
      {!data && !error && !loc && geoStatus !== "asking" && !showCityForm && (
        <p className="text-noor-textMuted">{t("pr.chooseLoc")}</p>
      )}

      {data && next && (
        <>
          <GlassCard className="text-center shadow-glow mb-6">
            <p className="text-xs uppercase tracking-wide text-noor-textMuted">{t("pr.next")}</p>
            <p className="text-4xl font-display text-noor-goldBright my-1">{t(`pn.${next.name}`)}</p>
            <p className="text-5xl font-display" aria-label={t("pr.timeUntil", { name: t(`pn.${next.name}`) })}>{countdown}</p>
            {next.approximate && <p className="text-xs text-noor-textMuted mt-1">{t("pr.tomorrowFajr")}</p>}
            {jStatus.waiting && (
              <p className="text-sm text-noor-goldBright mt-3" role="status">
                {t("pr.jamaatStarted", { name: t(`pn.${jStatus.waiting.name}`), at: fmt12At(jStatus.waiting.jamaatAt, data.timezone), in: hms(Math.max(0, jStatus.waiting.jamaatAt - now.getTime())) })}
              </p>
            )}
            {!jStatus.waiting && jStatus.next && (
              <p className="text-xs text-noor-textMuted mt-2">{t("pr.nextJamaat", { name: t(`pn.${jStatus.next.name}`), at: fmt12At(jStatus.next.at, data.timezone) })}</p>
            )}
            <p className="text-sm text-noor-textMuted mt-3">{data.hijriDate} • {data.gregorianDate}</p>
            {data.source === "device" && <p role="status" className="text-xs text-noor-textMuted mt-2">{t("pr.deviceCalc")}</p>}
          </GlassCard>

          {/* One tap to switch reminders on (the detailed settings are further down) */}
          {!settings.notificationsEnabled && (
            <GlassCard className="mb-6 flex flex-wrap items-center justify-between gap-3 border-noor-gold/40">
              <span className="text-sm">{t("pr.enableBanner")}</span>
              <button type="button" onClick={toggleNotifications} className="px-4 py-2 rounded-full bg-noor-gold text-noor-onAccent text-sm font-medium inline-flex items-center gap-2">
                <Bell size={14} aria-hidden="true" /> {t("pr.enableBtn")}
              </button>
            </GlassCard>
          )}
          {notifyMsg && !settings.notificationsEnabled && <p role="status" className="text-xs text-noor-goldBright -mt-4 mb-6">{notifyMsg}</p>}
          <div className="space-y-2">
            {ORDER.map((n) => (
              <div key={n} className={`glass-card px-5 py-3 flex items-center justify-between ${next.name === n && !next.approximate ? "border-noor-gold" : ""} ${n === "Fajr" && next.approximate ? "border-noor-gold" : ""}`}>
                <span className="flex items-center gap-3">
                  {user && n !== "Sunrise" && (
                    <button onClick={() => toggleDone(n)} aria-label={t("pr.markPrayed", { name: t(`pn.${n}`) })} aria-pressed={!!done[n]}
                      className={`w-6 h-6 rounded-full border flex items-center justify-center ${done[n] ? "bg-noor-gold border-noor-gold text-noor-onAccent" : "border-noor-border"}`}>
                      {done[n] && <Check size={14} />}
                    </button>
                  )}
                  {t(`pn.${n}`)}
                </span>
                <span className="text-end">
                  <span className="text-noor-goldBright">{clock(data.timings[n])}</span>
                  {jamaatText(n) && (
                    <span className="block text-xs text-noor-textMuted">
                      {t("pr.jamaat", { at: jamaatText(n) })}{jm[n].clamped ? t("pr.notBefore") : ""}
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-noor-textMuted mt-3">
            {data.timezone ? `${t("pr.timesFor", { tz: data.timezone })} ` : ""}
            {!user && <><Link to="/login" className="text-noor-goldBright">{t("nav.login")}</Link> {t("pr.loginTrack")}</>}
          </p>
        </>
      )}

      <DailyDua className="mt-8" />

      {user && stats && (
        <GlassCard className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-lg">{t("pr.logTitle")}</h2>
            <span className="text-xs text-noor-textMuted">{t("pr.logSummary", { n: doneCount, streak: t(stats.streak === 1 ? "progress.day" : "progress.days", { n: stats.streak }) })}</span>
          </div>
          <div className="flex items-end gap-2 h-20">
            {stats.last7.map((d) => (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1 h-full justify-end" title={`${d.date}: ${d.count}/5`}>
                <div className="w-full bg-noor-gold/80 rounded-t" style={{ height: `${(d.count / 5) * 100}%`, minHeight: d.count ? 4 : 2, opacity: d.count ? 1 : 0.25 }} />
                <span className="text-[10px] text-noor-textMuted">{d.date.slice(8)}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-noor-textMuted mt-3">{t("pr.logNote", { n: stats.totalLast30 })}</p>
        </GlassCard>
      )}

      {/* ---------------- Reminders ---------------- */}
      <GlassCard className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg">{t("pr.remTitle")}</h2>
          <button onClick={toggleNotifications} role="switch" aria-checked={settings.notificationsEnabled}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${settings.notificationsEnabled ? "bg-noor-gold text-noor-onAccent" : "bg-noor-surface2"}`}>
            {settings.notificationsEnabled ? <Bell size={14} /> : <BellOff size={14} />}
            {settings.notificationsEnabled ? t("pr.on") : t("pr.off")}
          </button>
        </div>

        {notifyMsg && <p role="status" className="text-xs text-noor-goldBright mt-2">{notifyMsg}</p>}
        {permission === "denied" && !notifyMsg && (
          <p className="text-xs text-red-400 mt-2">{t("pr.blocked")}</p>
        )}
        {saveError && <p role="alert" className="text-xs text-red-400 mt-2">{saveError}</p>}

        {settings.notificationsEnabled && (
          <div className="mt-4 space-y-5 text-sm">
            {permission !== "granted" && (
              <p className="text-xs text-red-400">{t("pr.notGranted")}</p>
            )}

            {/* 1. Will I get my alerts? */}
            <div className="rounded-xl border border-noor-border p-4 space-y-3">
              <p className="font-medium">{t("pr.stTitle")}</p>
              <ul className="space-y-2.5">
                <StatusRow ok={remindersActive} label={t("pr.stOpen")} />
                <StatusRow ok={remindersActive} label={t("pr.stMin")} />
                <StatusRow
                  ok={serverPush}
                  label={t("pr.stClosed")}
                  note={serverPush ? t("pr.stClosedOn") : !user ? null : push.support === "insecure" ? t("pr.bgInsecure") : push.support === "needs-install" ? t("pr.bgInstall") : push.support === "unsupported" ? t("pr.bgUnsupported") : push.support === "ok" && !push.serverReady ? t("pr.bgNoServer") : t("pr.stClosedOff")}
                />
              </ul>
              {!user && (
                <p className="text-xs text-noor-textMuted"><Link to="/login" className="text-noor-goldBright underline">{t("pr.stNeedLogin")}</Link></p>
              )}
              {user && push.support === "ok" && push.serverReady && (
                <div className="flex flex-wrap gap-2">
                  {push.subscribed ? (
                    <button onClick={turnOffPush} disabled={push.busy} className="px-3 py-1.5 rounded-full border border-noor-border text-xs">{t("pr.bgTurnOff")}</button>
                  ) : (
                    <button onClick={turnOnPush} disabled={push.busy || !place} className="px-4 py-2 rounded-full bg-noor-gold text-noor-onAccent text-xs font-medium">{t("pr.stTurnOn")}</button>
                  )}
                </div>
              )}
              {push.msg && <p role="status" className="text-xs text-noor-goldBright">{push.msg}</p>}
            </div>

            {/* 2. Simple settings */}
            <div className="rounded-xl border border-noor-border p-4 space-y-3">
              <p className="font-medium">{t("pr.setTitle")}</p>
              <label className="flex items-center justify-between gap-3">
                <span>{t("pr.remindBefore")}</span>
                <select value={settings.minutesBefore} onChange={(e) => updateSettings({ minutesBefore: Number(e.target.value) })} className={selectClass}>
                  <option value={0}>{t("pr.onlyAtTime")}</option>
                  {BEFORE_OPTIONS.map((m) => <option key={m} value={m}>{t("pr.minutes", { n: m })}</option>)}
                </select>
              </label>
              <div className="flex items-center justify-between gap-3">
                <span>{t("pr.playAdhan")}</span>
                <Switch checked={!!settings.adhanEnabled} onChange={(v) => updateSettings({ adhanEnabled: v })} label={t("pr.playAdhan")} />
              </div>
              {settings.jamaatEnabled && (
                <label className="flex items-center justify-between gap-3">
                  <span>{t("pr.remindJamaat")}</span>
                  <select value={settings.jamaatBefore} onChange={(e) => updateSettings({ jamaatBefore: Number(e.target.value) })} className={selectClass}>
                    <option value={0}>{t("pr.onlyAtJamaat")}</option>
                    {JAMAAT_BEFORE_OPTIONS.map((m) => <option key={m} value={m}>{t("pr.minutes", { n: m })}</option>)}
                  </select>
                </label>
              )}

              {/* each prayer: tucked away so the page stays calm */}
              <details className="group rounded-xl border border-noor-border">
                <summary className="cursor-pointer select-none list-none px-3 py-2.5 flex items-center justify-between">
                  <span>{t("pr.perPrayerTitle")}</span>
                  <span className="text-noor-textMuted text-xs group-open:rotate-180 transition-transform" aria-hidden="true">▼</span>
                </summary>
                <div className="px-3 pb-3 space-y-2">
                  {PRAYERS.map((p) => {
                    const on = settings.perPrayer[p] !== false;
                    const own = settings.before[p];
                    return (
                      <div key={p} className="rounded-xl border border-noor-border p-3 space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium">{t(`pn.${p}`)}{data && <span className="text-xs text-noor-textMuted font-normal"> · {clock(data.timings[p])}</span>}</span>
                          <Switch checked={on} onChange={(v) => updateSettings({ perPrayer: { [p]: v } })} label={t(`pn.${p}`)} />
                        </div>
                        {on && (
                          <div className="grid sm:grid-cols-2 gap-2 text-xs">
                            <label className="flex items-center justify-between gap-2">
                              <span>{t("pr.remindBeforeOne")}</span>
                              <select value={Number.isInteger(own) ? own : "default"} className={selectClass}
                                onChange={(e) => updateSettings({ before: { [p]: e.target.value === "default" ? null : Number(e.target.value) } })}>
                                <option value="default">{t("pr.sameAbove")}</option>
                                <option value={0}>{t("pr.onlyAtTime")}</option>
                                {BEFORE_OPTIONS.map((m) => <option key={m} value={m}>{t("pr.minutes", { n: m })}</option>)}
                              </select>
                            </label>
                            <div className="flex items-center justify-between gap-2">
                              <span>{t("pr.adhanFor", { name: t(`pn.${p}`) })}</span>
                              <Switch checked={settings.adhanPer[p] !== false} disabled={!settings.adhanEnabled} onChange={(v) => updateSettings({ adhanPer: { [p]: v } })} label={t("pr.adhanFor", { name: t(`pn.${p}`) })} />
                            </div>
                            <label className="sm:col-span-2 flex flex-col gap-1">
                              <span>{t("pr.customMsg")}</span>
                              <input key={`${p}-${settings.customMessage[p] || ""}`} defaultValue={settings.customMessage[p] || ""} maxLength={120}
                                placeholder={t("pr.timeFor", { name: t(`pn.${p}`) })} className={selectClass}
                                onBlur={(e) => { if (e.target.value.trim() !== (settings.customMessage[p] || "")) updateSettings({ customMessage: { [p]: e.target.value.trim() } }); }} />
                            </label>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </details>
            </div>

            {upcoming && (
              <p className="text-xs text-noor-textMuted" role="status">
                {t("pr.nextReminder", { time: new Date(upcoming.fireAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }), body: upcoming.body })}
              </p>
            )}

            {/* 3. Try it */}
            <div className="rounded-xl border border-noor-border p-4 space-y-3">
              <p className="font-medium">{t("pr.tryTitle")}</p>
              <p className="text-xs text-noor-textMuted">{t("pr.tryHelp")}</p>
              <div className="flex flex-wrap gap-2">
                <button onClick={sendTest} disabled={testBusy} className="px-4 py-2 rounded-full bg-noor-gold text-noor-onAccent text-sm font-medium inline-flex items-center gap-2 disabled:opacity-60">
                  <Bell size={14} aria-hidden="true" /> {t("pr.tryTest")}
                </button>
                {adhanOn ? (
                  <button onClick={() => adhanPlayer.stop()} className="px-4 py-2 rounded-full border border-noor-gold text-noor-goldBright text-sm inline-flex items-center gap-2">
                    <VolumeX size={14} aria-hidden="true" /> {t("pr.tryStop")}
                  </button>
                ) : (
                  <button onClick={() => adhanPlayer.play()} className="px-4 py-2 rounded-full border border-noor-border text-sm inline-flex items-center gap-2">
                    <Volume2 size={14} aria-hidden="true" /> {t("pr.tryAdhan")}
                  </button>
                )}
              </div>
            </div>

            <p className="text-xs text-noor-textMuted">{t("pr.friendlyNote")}</p>
          </div>
        )}
        {!settings.notificationsEnabled && (
          <p className="text-xs text-noor-textMuted mt-3">{user ? t("pr.turnOnHintAcct") : t("pr.turnOnHint")}</p>
        )}
      </GlassCard>

      {/* ---------------- Jamaat ---------------- */}
      <GlassCard className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg">{t("pr.jamaatTitle")}{lang !== "ur" && <span className="text-sm text-noor-textMuted"> (جماعت)</span>}</h2>
          <button onClick={() => updateSettings({ jamaatEnabled: !settings.jamaatEnabled })} role="switch" aria-checked={settings.jamaatEnabled}
            className={`px-3 py-1.5 rounded-full text-sm ${settings.jamaatEnabled ? "bg-noor-gold text-noor-onAccent" : "bg-noor-surface2"}`}>
            {settings.jamaatEnabled ? t("pr.on") : t("pr.off")}
          </button>
        </div>
        <p className="text-xs text-noor-textMuted mt-2">
          {t("pr.jamaatNote")}
        </p>
        {settings.jamaatEnabled && (
          <div className="mt-4 space-y-2 text-sm">
            {PRAYERS.map((p) => {
              const mode = settings.jamaatMode[p] || "off";
              const j = jm[p];
              return (
                <div key={p} className="rounded-xl border border-noor-border p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span>{t(`pn.${p}`)}{data && <span className="text-xs text-noor-textMuted"> • {t("pr.starts", { at: clock(data.timings[p]) })}</span>}</span>
                    <select aria-label={t("pr.jamaatType", { name: t(`pn.${p}`) })} value={mode} className={selectClass}
                      onChange={(e) => updateSettings({ jamaatMode: { [p]: e.target.value } })}>
                      <option value="off">{t("pr.jNone")}</option>
                      <option value="fixed">{t("pr.jFixed")}</option>
                      <option value="offset">{t("pr.jOffset")}</option>
                    </select>
                  </div>
                  {mode === "fixed" && (
                    <label className="flex items-center justify-between gap-2 text-xs">
                      <span>{t("pr.jAt", { name: t(`pn.${p}`) })}</span>
                      <input type="time" value={settings.jamaatTime[p] || ""} className={selectClass}
                        onChange={(e) => { if (e.target.value) updateSettings({ jamaatTime: { [p]: e.target.value } }); }} />
                    </label>
                  )}
                  {mode === "offset" && (
                    <label className="flex items-center justify-between gap-2 text-xs">
                      <span>{t("pr.jAfter", { name: t(`pn.${p}`) })}</span>
                      <select value={settings.jamaatOffset[p]} className={selectClass} onChange={(e) => updateSettings({ jamaatOffset: { [p]: Number(e.target.value) } })}>
                        {OFFSET_OPTIONS.includes(settings.jamaatOffset[p]) ? null : <option value={settings.jamaatOffset[p]}>{t("pr.min", { n: settings.jamaatOffset[p] })}</option>}
                        {OFFSET_OPTIONS.map((m) => <option key={m} value={m}>{t("pr.min", { n: m })}</option>)}
                      </select>
                    </label>
                  )}
                  {j && (
                    <p className="text-xs text-noor-textMuted">
                      {t("pr.todayJamaat", { name: t(`pn.${p}`) })} <span className="text-noor-goldBright">{fmt12At(j.at, data.timezone)}</span>
                      {j.clamped && t("pr.clamped")}
                    </p>
                  )}
                </div>
              );
            })}
            <p className="text-xs text-noor-textMuted">{t("pr.seasonal")}</p>
          </div>
        )}
      </GlassCard>

      {/* ---------------- Calculation ---------------- */}
      <GlassCard className="mt-6">
        <h2 className="font-display text-lg mb-3">{t("pr.calc")}</h2>
        <div className="space-y-3 text-sm">
          <div className="rounded-xl border border-noor-border p-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-noor-textMuted">{t("pr.preset")}</span>
            <button onClick={() => updateSettings(AHL_E_SUNNAT_PRESET)} className="px-3 py-1.5 rounded-full border border-noor-gold text-noor-goldBright text-xs">{t("pr.presetBtn")}</button>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-noor-textMuted">{t("pr.method")}</span>
            <select value={settings.method} onChange={(e) => updateSettings({ method: Number(e.target.value) })} className={`${selectClass} py-2`}>
              {METHODS.some((m) => m.id === settings.method) ? null : <option value={settings.method}>{t("method.other", { id: settings.method })}</option>}
              {METHODS.map((m) => <option key={m.id} value={m.id}>{t(m.label)}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-noor-textMuted">{t("pr.madhab")}</span>
            <select value={settings.school} onChange={(e) => updateSettings({ school: Number(e.target.value) })} className={`${selectClass} py-2`}>
              <option value={0}>{t("pr.madhabStd")}</option>
              <option value={1}>{t("pr.madhabHanafi")}</option>
            </select>
          </label>

          <fieldset>
            <legend className="text-noor-textMuted mb-2">{t("pr.adjust")}</legend>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {PRAYERS.map((p) => (
                <label key={p} className="flex flex-col gap-1 text-xs">
                  {t(`pn.${p}`)}
                  <select value={settings.adjust[p] || 0} onChange={(e) => updateSettings({ adjust: { [p]: Number(e.target.value) } })} className={selectClass}>
                    {ADJUST_OPTIONS.map((m) => <option key={m} value={m}>{m > 0 ? `+${m}` : m}</option>)}
                  </select>
                </label>
              ))}
            </div>
            {anyAdjust && (
              <button onClick={() => updateSettings({ adjust: { Fajr: 0, Dhuhr: 0, Asr: 0, Maghrib: 0, Isha: 0 } })} className="mt-2 text-xs text-noor-goldBright underline">
                {t("pr.resetAdjust")}
              </button>
            )}
          </fieldset>
          <p className="text-xs text-noor-textMuted">{t("pr.calcNote")}</p>
        </div>
      </GlassCard>

      {adhanOn && (
        <div role="status" aria-live="polite" className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-50 glass-card px-5 py-3 flex items-center gap-4 shadow-glow">
          <span className="text-sm">{t("pr.adhanPlaying")}</span>
          <button onClick={() => adhanPlayer.stop()} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-noor-gold text-noor-onAccent text-sm font-medium">
            <VolumeX size={14} /> {t("rec.stop")}
          </button>
        </div>
      )}
    </div>
  );
}
