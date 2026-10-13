import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, BellOff, MapPin, Moon, Sunrise, Sunset } from "lucide-react";
import api from "../../services/api";
import GlassCard from "../../components/GlassCard";
import { ErrorState } from "../../components/Skeleton";
import { useToast } from "../../components/Toast";
import { useAuth } from "../../context/AuthContext";
import usePlace, { placeLabel, placeParams } from "../../hooks/usePlace";
import usePrayerNotifications from "../../hooks/usePrayerNotifications";
import {
  fetchFasting, fetchPrayerSettings, fetchRamadanDuas, fetchRamadanInfo, fetchRamadanTimetable, setFasting,
} from "../../services/contentService";
import { askPermission, currentPermission, notificationSupport, showPrayerNotification } from "../../services/prayerNotify";
import { tuneFromSettings, withDefaults } from "../../utils/prayerSchedule";
import { addDays, formatDMY, localDate, localDateDMY } from "../../utils/date";
import { PLAN_DAYS, clampPlanDays, currentRun, longestRun, pageRangeForDay } from "../../utils/ramadanPlan";
import { daysUntilText, hijriMonthName } from "../../utils/hijriText";
import { formatDMYLocale } from "../../utils/date";
import { buildRamadanEvents, formatCountdown, ramadanCountdown, sanitizeReminders } from "../../utils/ramadanSchedule";
import { useI18n } from "../../context/I18nContext";

const LOCAL_SETTINGS_KEY = "siraj_prayer_settings"; // prayer settings saved on this device (same as the Prayer page)
const REMINDERS_KEY = "siraj_ramadan_reminders";
const PLAN_KEY = "siraj_ramadan_plan_days";

function readJSON(key) {
  try { return JSON.parse(localStorage.getItem(key) || "null"); } catch (e) { return null; }
}
function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignore */ }
}
function loadLocalSettings() {
  const saved = readJSON(LOCAL_SETTINGS_KEY) || {};
  const legacyMethod = Number(localStorage.getItem("siraj_method")) || undefined;
  const legacySchool = Number(localStorage.getItem("siraj_school"));
  return withDefaults({
    ...(legacyMethod ? { method: legacyMethod } : {}),
    ...(legacySchool === 0 || legacySchool === 1 ? { school: legacySchool } : {}),
    ...saved,
  });
}
const clock = (t) => String(t || "—").split(" ")[0];
const selectClass = "rounded-lg bg-noor-surface2 border border-noor-border px-2 py-1";

export default function Ramadan() {
  const { user } = useAuth();
  const { t, lang, locale, isRTL } = useI18n();
  const fmt = (dmy, wd) => formatDMYLocale(dmy, wd, locale);
  const arrowDir = isRTL ? "←" : "→";
  const { toastEl, notify } = useToast();
  const [now, setNow] = useState(new Date());
  const [settings, setSettings] = useState(loadLocalSettings);
  const { place, status, locate, setCity } = usePlace({ city: settings.city, country: settings.country });
  const [showCityForm, setShowCityForm] = useState(false);
  const [cityInput, setCityInput] = useState("");
  const [countryInput, setCountryInput] = useState("");

  const [data, setData] = useState(null);          // today's times
  const [tomorrow, setTomorrow] = useState(null);  // tomorrow's times (for the Sehri countdown after Iftar)
  const [error, setError] = useState("");
  const [reloadTick, setReloadTick] = useState(0);
  const [info, setInfo] = useState(null);          // next / current Ramadan
  const [fasting, setFastingData] = useState(null);
  const [duas, setDuas] = useState([]);
  const [table, setTable] = useState(null);
  const [tableState, setTableState] = useState("idle"); // idle | loading | error
  const [planDays, setPlanDays] = useState(() => clampPlanDays(localStorage.getItem(PLAN_KEY)));
  const [reminders, setReminders] = useState(() => sanitizeReminders(readJSON(REMINDERS_KEY)));
  const [permission, setPermission] = useState(currentPermission());

  const today = localDate(now);
  const method = settings.method;
  const school = settings.school;
  const tune = tuneFromSettings(settings);
  const params = placeParams(place);
  const placeKey = JSON.stringify(params);

  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    const refresh = () => setPermission(currentPermission());
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);

  // Prayer settings: the account's when logged in, this device's otherwise (same choice as on the Prayer page)
  useEffect(() => {
    if (!user) { setSettings(loadLocalSettings()); return; }
    fetchPrayerSettings().then((s) => setSettings(withDefaults(s))).catch(() => {});
  }, [user]);

  // Today's and tomorrow's times. Runs again after midnight (today changes) and when the place/method changes.
  useEffect(() => {
    if (!params) return undefined;
    let cancelled = false;
    setError("");
    const base = { ...params, method, school, ...(tune ? { tune } : {}) };
    Promise.all([
      api.get("/prayer/times", { params: { ...base, date: localDateDMY() } }),
      api.get("/prayer/times", { params: { ...base, date: localDateDMY(addDays(new Date(), 1)) } }).catch(() => null),
    ])
      .then(([a, b]) => {
        if (cancelled) return;
        setData(a.data.data);
        setTomorrow(b ? b.data.data : null);
      })
      .catch((e) => {
        if (!cancelled) setError(e.response?.data?.message || t("ram.loadError"));
      });
    return () => { cancelled = true; };
  }, [placeKey, method, school, tune, today, reloadTick]); // eslint-disable-line react-hooks/exhaustive-deps

  // A different place or method makes an already loaded timetable wrong
  useEffect(() => { setTable(null); setTableState("idle"); }, [placeKey, method, school, tune]);

  // Next / current Ramadan (does not need the location)
  useEffect(() => { fetchRamadanInfo(localDateDMY()).then(setInfo).catch(() => setInfo(null)); }, [today]);
  useEffect(() => { fetchRamadanDuas().then(setDuas).catch(() => setDuas([])); }, []);

  const hijri = data?.hijri;
  useEffect(() => {
    if (!user || !hijri) return;
    fetchFasting(hijri.year).then(setFastingData).catch(() => {});
  }, [user, hijri?.year]); // eslint-disable-line react-hooks/exhaustive-deps

  const isRamadan = hijri?.monthNumber === 9;
  const fastedDays = new Set(fasting?.ramadanDays || []);
  const countdown = data ? ramadanCountdown(now.getTime(), data, tomorrow) : null;

  // ---------- reminders (only while SIRAJ is open in a tab) ----------
  const support = notificationSupport();
  const events = useMemo(() => buildRamadanEvents([data, tomorrow], reminders), [data, tomorrow, reminders]);
  usePrayerNotifications(events, reminders.enabled && permission === "granted");

  function updateReminders(patch) {
    const next = sanitizeReminders({ ...reminders, ...patch });
    setReminders(next);
    writeJSON(REMINDERS_KEY, next);
  }
  async function toggleReminders() {
    if (reminders.enabled) { updateReminders({ enabled: false }); return; }
    const result = await askPermission();
    setPermission(result);
    if (result !== "granted") {
      notify(result === "denied" ? t("ram.notifBlocked") : t("ram.notifNotAllowed"));
      return;
    }
    updateReminders({ enabled: true });
  }
  async function sendTest() {
    const ok = await showPrayerNotification({ title: t("ram.testTitle"), body: t("ram.testBody"), tag: "siraj-ramadan-test", url: "/ramadan" });
    notify(ok ? t("ram.testSent") : t("ram.testFail"));
  }

  // ---------- fasting record ----------
  // Mark / unmark a day. `dayOffset` = how many days ago (0 = today).
  async function toggleDay({ hijriDay, hijriMonth, dayOffset, isFasted }) {
    if (!user) return notify(t("ram.loginFast"));
    const d = new Date(); d.setDate(d.getDate() - dayOffset);
    const payload = { date: localDate(d), hijriYear: hijri.year, hijriMonth, hijriDay, fasted: !isFasted };
    try {
      await setFasting(payload);
      const fresh = await fetchFasting(hijri.year);
      setFastingData(fresh);
      notify(payload.fasted ? t("ram.marked") : t("ram.removed"));
    } catch (e) { notify(e.response?.data?.message || t("ram.saveFail")); }
  }

  // ---------- Quran plan ----------
  function changePlan(value) {
    const days = clampPlanDays(value);
    setPlanDays(days);
    try { localStorage.setItem(PLAN_KEY, String(days)); } catch (e) { /* ignore */ }
  }
  const planDay = isRamadan ? hijri.day : 1; // before Ramadan: show what day 1 will be
  const range = pageRangeForDay(planDay, planDays);

  // ---------- timetable ----------
  const timetableYear = info?.ramadanYear || (hijri ? (hijri.monthNumber > 9 ? hijri.year + 1 : hijri.year) : null);
  function loadTimetable() {
    if (!params || !timetableYear) return;
    setTableState("loading");
    fetchRamadanTimetable({ ...params, method, school, ...(tune ? { tune } : {}), hijriYear: timetableYear })
      .then((r) => { setTable(r); setTableState("idle"); })
      .catch(() => setTableState("error"));
  }

  function submitCity(e) {
    e.preventDefault();
    if (setCity(cityInput, countryInput)) setShowCityForm(false);
  }

  const needsPlace = !place && status !== "asking" && status !== "idle";

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      {toastEl}
      <h1 className="text-3xl font-display text-noor-goldBright mb-2">{t("footer.ramadan")}</h1>
      <p className="text-noor-textMuted mb-6">{t("ram.subtitle")}</p>

      <div className="space-y-6">
        {/* Where are the times for? */}
        <GlassCard className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm flex items-center gap-2">
              <MapPin size={16} className="text-noor-goldBright" aria-hidden="true" />
              {place ? <span>{t("ram.timesFor")} <strong>{placeLabel(place)}</strong></span> : status === "asking" ? <span>{t("ram.finding")}</span> : <span>{t("ram.needLoc")}</span>}
            </p>
            <div className="flex gap-2 text-sm">
              <button onClick={locate} className="px-3 py-1 rounded-full border border-noor-border hover:bg-noor-surface2">{t("ram.useMyLoc")}</button>
              <button onClick={() => setShowCityForm((v) => !v)} aria-expanded={showCityForm} className="px-3 py-1 rounded-full border border-noor-border hover:bg-noor-surface2">{t("ram.chooseCity")}</button>
            </div>
          </div>
          {needsPlace && !showCityForm && <p className="text-sm text-noor-textMuted">{t("ram.locDenied")}</p>}
          {(showCityForm || needsPlace) && (
            <form onSubmit={submitCity} className="grid sm:grid-cols-3 gap-2 text-sm">
              <label>
                <span className="sr-only">{t("pr.city")}</span>
                <input value={cityInput} onChange={(e) => setCityInput(e.target.value)} placeholder={t("ram.cityPh")} maxLength={80} className={`${selectClass} w-full`} />
              </label>
              <label>
                <span className="sr-only">{t("pr.country")}</span>
                <input value={countryInput} onChange={(e) => setCountryInput(e.target.value)} placeholder={t("ram.countryPh")} maxLength={80} className={`${selectClass} w-full`} />
              </label>
              <button type="submit" className="px-4 py-1 rounded-full bg-noor-gold text-noor-onAccent font-medium hover:bg-noor-goldBright">{t("ram.showTimes")}</button>
            </form>
          )}
          <p className="text-xs text-noor-textMuted">{t("ram.calcFrom")} <Link to="/prayer" className="text-noor-goldBright">{t("ram.prayerSettings")}</Link>.</p>
        </GlassCard>

        {error && <ErrorState message={error} onRetry={() => setReloadTick((n) => n + 1)} />}
        {place && !data && !error && <p className="text-noor-textMuted" role="status">{t("ram.loadingTimes")}</p>}

        {/* Ramadan status + countdown */}
        {(data || info) && (
          <GlassCard className="text-center shadow-glow">
            {data && <p className="text-xs uppercase tracking-wide text-noor-textMuted flex items-center justify-center gap-1"><Moon size={14} aria-hidden="true" /> {data.hijriDate}</p>}
            {isRamadan && <p className="text-lg text-noor-goldBright mt-1">{t("ram.dayOf", { year: hijri.year, day: hijri.day })}</p>}
            {!isRamadan && info && (
              <>
                <p className="text-lg text-noor-goldBright mt-1">{t("ram.expected", { year: info.ramadanYear, when: daysUntilText(t, info.daysUntil) })}</p>
                <p className="text-sm text-noor-textMuted">{t("ram.firstDay", { date: fmt(info.firstDay.date, true) })}</p>
              </>
            )}
            {!isRamadan && !info && data && <p className="text-lg text-noor-goldBright mt-1">{t("ram.notNow", { month: hijriMonthName(t, hijri.monthNumber, hijri.monthEn) })}</p>}
            <p className="text-xs text-noor-textMuted mt-1">{t("ram.moon")}</p>
            {countdown && (
              <>
                <p className="text-sm text-noor-textMuted mt-4">{t(countdown.label === "Iftar in" ? "ram.c.iftar" : countdown.label === "Sehri ends in" ? "ram.c.sehri" : "ram.c.sehriApprox")}</p>
                <p className="text-5xl font-display" role="timer" aria-live="off">{formatCountdown(countdown.at - now.getTime())}</p>
              </>
            )}
          </GlassCard>
        )}

        {data && (
          <>
            <div className="grid sm:grid-cols-3 gap-3">
              <GlassCard className="text-center">
                <Moon size={18} className="mx-auto mb-1 text-noor-goldBright" aria-hidden="true" />
                <p className="text-xs text-noor-textMuted">{t("ram.imsak")}</p>
                <p className="text-2xl font-display">{clock(data.timings.Imsak)}</p>
              </GlassCard>
              <GlassCard className="text-center">
                <Sunrise size={18} className="mx-auto mb-1 text-noor-goldBright" aria-hidden="true" />
                <p className="text-xs text-noor-textMuted">{t("pn.Fajr")}</p>
                <p className="text-2xl font-display">{clock(data.timings.Fajr)}</p>
              </GlassCard>
              <GlassCard className="text-center">
                <Sunset size={18} className="mx-auto mb-1 text-noor-goldBright" aria-hidden="true" />
                <p className="text-xs text-noor-textMuted">{t("ram.iftar")}</p>
                <p className="text-2xl font-display">{clock(data.timings.Maghrib)}</p>
              </GlassCard>
            </div>
            <p className="text-xs text-noor-textMuted">{t("ram.timesNote")}</p>

            {/* Reminders */}
            <GlassCard className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg flex items-center gap-2">{reminders.enabled ? <Bell size={18} aria-hidden="true" /> : <BellOff size={18} aria-hidden="true" />} {t("ram.remTitle")}</h2>
                <button onClick={toggleReminders} aria-pressed={reminders.enabled} disabled={support !== "ok"}
                  className={`px-4 py-1.5 rounded-full text-sm border ${reminders.enabled ? "bg-noor-gold text-noor-onAccent border-noor-gold" : "border-noor-border hover:bg-noor-surface2"} disabled:opacity-40`}>
                  {reminders.enabled ? t("pr.on") : t("pr.off")}
                </button>
              </div>
              {support === "unsupported" && <p className="text-sm text-noor-textMuted">{t("ram.unsupported")}</p>}
              {support === "insecure" && <p className="text-sm text-noor-textMuted">{t("ram.insecure")}</p>}
              {support === "ok" && permission === "denied" && <p className="text-sm text-noor-textMuted">{t("ram.blocked")}</p>}
              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                <label className="flex items-center justify-between gap-2">
                  <span>{t("ram.beforeSehri")}</span>
                  <select value={reminders.sehriBefore} onChange={(e) => updateReminders({ sehriBefore: Number(e.target.value) })} className={selectClass}>
                    {[0, 10, 15, 20, 30, 45, 60].map((n) => <option key={n} value={n}>{n === 0 ? t("ram.noReminder") : t("pr.minutes", { n })}</option>)}
                  </select>
                </label>
                <label className="flex items-center justify-between gap-2">
                  <span>{t("ram.beforeIftar")}</span>
                  <select value={reminders.iftarBefore} onChange={(e) => updateReminders({ iftarBefore: Number(e.target.value) })} className={selectClass}>
                    {[0, 5, 10, 15, 20, 30].map((n) => <option key={n} value={n}>{n === 0 ? t("ram.noReminder") : t("pr.minutes", { n })}</option>)}
                  </select>
                </label>
                <label className="flex items-center gap-2 sm:col-span-2">
                  <input type="checkbox" checked={reminders.iftarAt} onChange={(e) => updateReminders({ iftarAt: e.target.checked })} />
                  <span>{t("ram.notifyIftar")}</span>
                </label>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={sendTest} disabled={permission !== "granted"} className="px-4 py-1.5 rounded-full border border-noor-border text-sm hover:bg-noor-surface2 disabled:opacity-40">{t("pr.sendTest")}</button>
              </div>
              <p className="text-xs text-noor-textMuted">{t("ram.remNote")} <Link to="/prayer" className="text-noor-goldBright">{t("prof.prayerPage")}</Link>.</p>
            </GlassCard>

            {/* Fasting tracker */}
            <GlassCard className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg">{t("ram.fastTitle")}</h2>
                {user && fasting && <p className="text-sm text-noor-textMuted">{t("ram.fastCount", { year: hijri.year, n: fasting.ramadanCount })}</p>}
              </div>

              {!user && <p className="text-sm text-noor-textMuted"><Link to="/login" className="text-noor-goldBright">{t("nav.login")}</Link> {t("ram.fastLogin")}</p>}

              {user && isRamadan && (
                <>
                  <p className="text-xs text-noor-textMuted">{t("ram.fastTap")}</p>
                  <div className="grid grid-cols-6 sm:grid-cols-10 gap-2">
                    {Array.from({ length: 30 }, (_, i) => i + 1).map((day) => {
                      const offset = hijri.day - day;
                      const allowed = offset >= 0;
                      const isFasted = fastedDays.has(day);
                      return (
                        <button key={day} disabled={!allowed} aria-pressed={isFasted} aria-label={t(isFasted ? "ram.dayAriaFasted" : "ram.dayAria", { n: day })}
                          onClick={() => toggleDay({ hijriDay: day, hijriMonth: 9, dayOffset: offset, isFasted })}
                          className={`aspect-square rounded-lg text-sm border transition-colors ${isFasted ? "bg-noor-gold text-noor-onAccent border-noor-gold" : "bg-noor-surface2 border-noor-border"} ${allowed ? "" : "opacity-30 cursor-not-allowed"} ${day === hijri.day ? "ring-2 ring-noor-goldBright" : ""}`}>
                          {day}
                        </button>
                      );
                    })}
                  </div>
                  {fasting && (
                    <p className="text-xs text-noor-textMuted">
                      {t("ram.run", { cur: currentRun(fasting.ramadanDays, hijri.day), longest: longestRun(fasting.ramadanDays) })}
                    </p>
                  )}
                </>
              )}

              {user && !isRamadan && (
                <>
                  <p className="text-sm text-noor-textMuted">{t("ram.notRamadan")} <Link to="/calendar" className="text-noor-goldBright">{t("footer.calendar")}</Link> {t("ram.notRamadan2")}</p>
                  <button
                    onClick={() => toggleDay({ hijriDay: hijri.day, hijriMonth: hijri.monthNumber, dayOffset: 0, isFasted: (fasting?.dates || []).includes(localDate()) })}
                    className="px-5 py-2 rounded-full border border-noor-gold text-noor-goldBright text-sm hover:bg-noor-surface2">
                    {(fasting?.dates || []).includes(localDate()) ? t("ram.removeToday") : t("ram.fastingToday")}
                  </button>
                  {fasting && <p className="text-xs text-noor-textMuted">{t("ram.other", { n: fasting.otherCount })}</p>}
                </>
              )}
            </GlassCard>
          </>
        )}

        {/* Quran plan: needs no location */}
        <GlassCard className="space-y-3">
          <h2 className="text-lg">{t("ram.planTitle")}</h2>
          <label className="flex flex-wrap items-center gap-2 text-sm">
            <span>{t("ram.finishIn")}</span>
            <select value={planDays} onChange={(e) => changePlan(e.target.value)} className={selectClass}>
              {[...new Set([...PLAN_DAYS, planDays])].sort((a, b) => a - b).map((n) => <option key={n} value={n}>{t("ram.nDays", { n })}</option>)}
            </select>
            <span className="text-noor-textMuted">{t("ram.shared")}</span>
          </label>
          {range ? (
            <div className="space-y-2">
              <p className="text-sm">
                {isRamadan ? t("ram.todayDay", { n: planDay }) : t("ram.day1")} <strong className="text-noor-goldBright">{t("ram.pages", { start: range.start, end: range.end })}</strong> {t("ram.pagesCount", { n: range.count })}
              </p>
              <div className="flex flex-wrap gap-2 text-sm">
                <Link to={`/quran/page/${range.start}`} className="glass-card px-4 py-2 hover:shadow-emeraldGlow">{t("ram.openPage", { n: range.start })}</Link>
                {planDays === 30 && isRamadan && <Link to={`/quran/juz/${planDay}`} className="glass-card px-4 py-2 hover:shadow-emeraldGlow">{t("ram.orJuz", { n: planDay })}</Link>}
                <Link to="/progress" className="glass-card px-4 py-2 hover:shadow-emeraldGlow">{t("ram.khatm")}</Link>
              </div>
            </div>
          ) : (
            <p className="text-sm text-noor-textMuted">{t("ram.planDone", { n: planDays })} <Link to="/progress" className="text-noor-goldBright">{t("ram.khatm")}</Link>.</p>
          )}
          <p className="text-xs text-noor-textMuted">{t("ram.planNote")}</p>
        </GlassCard>

        {/* Duas */}
        {duas.length > 0 && (
          <GlassCard className="space-y-4">
            <h2 className="text-lg">{t("ram.duasTitle")}</h2>
            {duas.map((d) => {
              // one language per page: English shows English + transliteration, Urdu / Arabic show only Urdu / Arabic
              const loc = lang === "en" ? null : d[lang];
              const title = loc?.title || d.title;
              const meaning = loc?.meaning || d.english;
              const source = loc?.source || d.source;
              return (
                <article key={d.id} className="border-t border-noor-border pt-3 first:border-0 first:pt-0">
                  <h3 className="text-sm text-noor-textMuted mb-2">{title}</h3>
                  <p lang="ar" dir="rtl" className="text-2xl leading-loose font-arabic text-center">{d.arabic}</p>
                  {lang === "en" && <p className="text-sm italic text-center text-noor-textMuted mt-2">{d.transliteration}</p>}
                  <p lang={lang} dir={lang === "en" ? "ltr" : "rtl"} className="text-sm text-center mt-1">{meaning}</p>
                  <p lang={lang} dir={lang === "en" ? "ltr" : "rtl"} className="text-xs text-noor-goldBright text-center mt-2">{t("duas.source")}: {source}</p>
                </article>
              );
            })}
            <p className="text-xs text-noor-textMuted">{t("ram.moreDuas")} <Link to="/duas" className="text-noor-goldBright">{t("duas.title")}</Link>.</p>
          </GlassCard>
        )}

        {/* Timetable */}
        {place && timetableYear && (
          <GlassCard className="space-y-3">
            <h2 className="text-lg">{t("ram.ttTitle", { year: timetableYear })}</h2>
            {!table && (
              <>
                <p className="text-sm text-noor-textMuted">{t("ram.ttIntro", { place: placeLabel(place) })}</p>
                <button onClick={loadTimetable} disabled={tableState === "loading"} className="px-5 py-2 rounded-full border border-noor-gold text-noor-goldBright text-sm hover:bg-noor-surface2 disabled:opacity-50">
                  {tableState === "loading" ? t("common.loading") : t("ram.ttShow")}
                </button>
                {tableState === "error" && <p role="alert" className="text-sm text-red-300">{t("ram.ttError")}</p>}
              </>
            )}
            {table && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-center">
                  <caption className="sr-only">{t("ram.ttCaption", { year: table.hijriYear })}</caption>
                  <thead className="text-noor-textMuted text-xs">
                    <tr>
                      <th scope="col" className="py-2 px-2">{t("ram.thDay")}</th>
                      <th scope="col" className="py-2 px-2 text-start">{t("ram.thDate")}</th>
                      <th scope="col" className="py-2 px-2">{t("ram.thSehri")}</th>
                      <th scope="col" className="py-2 px-2">{t("pn.Fajr")}</th>
                      <th scope="col" className="py-2 px-2">{t("ram.thIftar")}</th>
                      {user && table.hijriYear === hijri?.year && <th scope="col" className="py-2 px-2">{t("ram.thFasted")}</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {table.days.map((row) => {
                      const isToday = row.gregorianDate === localDateDMY(now);
                      return (
                        <tr key={row.hijriDay} aria-current={isToday ? "date" : undefined} className={`border-t border-noor-border ${isToday ? "bg-noor-surface2 text-noor-goldBright" : ""}`}>
                          <td className="py-1.5 px-2">{row.hijriDay}</td>
                          <td className="py-1.5 px-2 text-start whitespace-nowrap">{fmt(row.gregorianDate, true)}</td>
                          <td className="py-1.5 px-2">{row.imsak}</td>
                          <td className="py-1.5 px-2">{row.fajr}</td>
                          <td className="py-1.5 px-2">{row.maghrib}</td>
                          {user && table.hijriYear === hijri?.year && <td className="py-1.5 px-2">{fastedDays.has(row.hijriDay) ? <span aria-label={t("ram.fastedAria")}>✓</span> : <span className="text-noor-textMuted" aria-label={t("ram.notMarked")}>–</span>}</td>}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-xs text-noor-textMuted">{t("ram.ttNote")}</p>
          </GlassCard>
        )}

        <GlassCard>
          <h2 className="text-lg mb-3">{t("ram.shortcuts")}</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <Link to="/quran" className="glass-card px-4 py-3 hover:shadow-emeraldGlow">{t("ram.sc.quran")}</Link>
            <Link to="/progress" className="glass-card px-4 py-3 hover:shadow-emeraldGlow">{t("ram.khatm")}</Link>
            <Link to="/goals" className="glass-card px-4 py-3 hover:shadow-emeraldGlow">{t("ram.sc.goal")}</Link>
            <Link to="/duas" className="glass-card px-4 py-3 hover:shadow-emeraldGlow">{t("ram.sc.duas")}</Link>
            <Link to="/prayer" className="glass-card px-4 py-3 hover:shadow-emeraldGlow">{t("ram.sc.prayer")}</Link>
            <Link to="/calendar" className="glass-card px-4 py-3 hover:shadow-emeraldGlow">{t("footer.calendar")}</Link>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
