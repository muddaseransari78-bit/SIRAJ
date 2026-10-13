import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { convertDate, fetchCalendar, fetchFasting, fetchUpcomingEvents, setFasting } from "../../services/contentService";
import { ErrorState } from "../../components/Skeleton";
import GlassCard from "../../components/GlassCard";
import { useToast } from "../../components/Toast";
import { useAuth } from "../../context/AuthContext";
import { formatDMYLocale, localDate, localDateDMY } from "../../utils/date";
import { eventName, eventNote, hijriMonthName, daysUntilText, gregorianMonth, weekdayShort, weekdayLong } from "../../utils/hijriText";
import { useI18n } from "../../context/I18nContext";

const WEEK_IDX = [0, 1, 2, 3, 4, 5, 6];
const HIJRI_IDX = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const pad = (n) => String(n).padStart(2, "0");
const inputClass = "rounded-lg bg-noor-surface2 border border-noor-border px-2 py-1";

// "2026-10-02" (from <input type="date">) -> "02-10-2026" (what the API wants)
const isoToDMY = (iso) => { const [y, m, d] = String(iso).split("-"); return y && m && d ? `${d}-${m}-${y}` : ""; };

export default function Calendar() {
  const { t, locale, isRTL } = useI18n();
  const monthName = (m) => gregorianMonth(locale, m);
  const fmt = (dmy, wd) => formatDMYLocale(dmy, wd, locale);
  const hm = (n, fb) => hijriMonthName(t, n, fb);
  const { user } = useAuth();
  const { toastEl, notify } = useToast();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState(now.getDate());
  const [fastDates, setFastDates] = useState(new Set()); // "YYYY-MM-DD" days the user marked as fasted
  const [todayHijri, setTodayHijri] = useState(null);
  const [upcoming, setUpcoming] = useState(null);
  const [upcomingError, setUpcomingError] = useState(false);

  // converter
  const [mode, setMode] = useState("g2h"); // g2h = Gregorian -> Hijri, h2g = Hijri -> Gregorian
  const [gDate, setGDate] = useState(localDate());
  const [hDay, setHDay] = useState(1);
  const [hMonth, setHMonth] = useState(9);
  const [hYear, setHYear] = useState(1448);
  const [converted, setConverted] = useState(null);
  const [convertError, setConvertError] = useState("");
  const [converting, setConverting] = useState(false);

  const load = () => { setError(false); setData(null); fetchCalendar(month, year).then(setData).catch(() => setError(true)); };
  useEffect(load, [month, year]); // eslint-disable-line react-hooks/exhaustive-deps

  // Today's Hijri date + the next events (independent of the month being viewed)
  useEffect(() => {
    convertDate({ gregorian: localDateDMY() }).then((r) => { setTodayHijri(r.hijri); setHYear(r.hijri.year); }).catch(() => {});
    setUpcomingError(false);
    fetchUpcomingEvents(localDateDMY(), 8).then(setUpcoming).catch(() => setUpcomingError(true));
  }, []);

  const days = data?.days || [];

  // The user's fasting days for every Hijri year this month touches
  const hijriYearsKey = [...new Set(days.map((d) => d.hijriYear))].join(",");
  const loadFasts = useCallback(() => {
    if (!user || !hijriYearsKey) { setFastDates(new Set()); return Promise.resolve(); }
    const years = hijriYearsKey.split(",").map(Number);
    return Promise.all(years.map((y) => fetchFasting(y).catch(() => ({ dates: [] }))))
      .then((list) => setFastDates(new Set(list.flatMap((r) => r.dates || []))));
  }, [user, hijriYearsKey]);
  useEffect(() => { loadFasts(); }, [loadFasts]);

  const shift = (d) => {
    let m = month + d, y = year;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    setMonth(m); setYear(y); setSelected(null);
  };
  const goToday = () => { setMonth(now.getMonth() + 1); setYear(now.getFullYear()); setSelected(now.getDate()); };

  const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear();
  const isToday = (d) => d.gregorianDay === now.getDate() && isCurrentMonth;
  const isFuture = (d) => new Date(year, month - 1, d.gregorianDay) > new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const isoOf = (d) => `${year}-${pad(month)}-${pad(d.gregorianDay)}`;

  const offset = days.length ? new Date(year, month - 1, 1).getDay() : 0;
  const events = days.filter((d) => d.events.length);
  const hijriRange = days.length
    ? `${hm(days[0].hijriMonthNumber, days[0].hijriMonth)} ${days[0].hijriYear}${days[0].hijriMonthNumber !== days[days.length - 1].hijriMonthNumber ? ` – ${hm(days[days.length - 1].hijriMonthNumber, days[days.length - 1].hijriMonth)} ${days[days.length - 1].hijriYear}` : ""}`
    : "";
  const selectedDay = days.find((d) => d.gregorianDay === selected) || null;
  const selectedFasted = selectedDay ? fastDates.has(isoOf(selectedDay)) : false;

  async function toggleFast(d) {
    if (!user) return notify(t("cal.loginFirst"));
    const payload = { date: isoOf(d), hijriYear: d.hijriYear, hijriMonth: d.hijriMonthNumber, hijriDay: d.hijriDay, fasted: !fastDates.has(isoOf(d)) };
    try {
      await setFasting(payload);
      await loadFasts();
      notify(payload.fasted ? t("cal.markedFasted") : t("cal.fastRemoved"));
    } catch (e) { notify(e.response?.data?.message || t("cal.saveFail")); }
  }

  async function runConvert(e) {
    e.preventDefault();
    setConvertError(""); setConverted(null);
    let params;
    if (mode === "g2h") {
      const dmy = isoToDMY(gDate);
      if (!dmy) { setConvertError(t("cal.errDate")); return; }
      params = { gregorian: dmy };
    } else {
      const d = Number(hDay), y = Number(hYear);
      if (!Number.isInteger(d) || d < 1 || d > 30) { setConvertError(t("cal.errHDay")); return; }
      if (!Number.isInteger(y) || y < 1300 || y > 1700) { setConvertError(t("cal.errHYear")); return; }
      params = { hijri: `${pad(d)}-${pad(hMonth)}-${y}` };
    }
    setConverting(true);
    try { setConverted(await convertDate(params)); }
    catch (err) { setConvertError(err.response?.data?.message || t("cal.errConvert")); }
    finally { setConverting(false); }
  }

  const hijriText = (h) => `${h.day} ${hm(h.monthNumber, h.monthEn)} ${h.year}`;

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      {toastEl}
      <h1 className="text-3xl font-display text-noor-goldBright mb-2">{t("footer.calendar")}</h1>
      {todayHijri && <p className="text-noor-textMuted mb-6">{t("cal.today")} <strong className="text-noor-text">{hijriText(todayHijri)}</strong> · {fmt(localDateDMY(), true)}</p>}
      {!todayHijri && <div className="mb-6" />}

      <div className="flex items-center justify-between mb-4 gap-2">
        <button onClick={() => shift(-1)} aria-label={t("cal.prevMonth")} className="p-2 rounded-full bg-noor-surface2">{isRTL ? <ChevronRight size={18} aria-hidden="true" /> : <ChevronLeft size={18} aria-hidden="true" />}</button>
        <div className="text-center">
          <p className="text-xl font-display" aria-live="polite">{monthName(month)} {year}</p>
          <p className="text-sm text-noor-goldBright">{hijriRange}</p>
          {!isCurrentMonth && <button onClick={goToday} className="text-xs text-noor-goldBright underline mt-1">{t("cal.backToday")}</button>}
        </div>
        <button onClick={() => shift(1)} aria-label={t("cal.nextMonth")} className="p-2 rounded-full bg-noor-surface2">{isRTL ? <ChevronLeft size={18} aria-hidden="true" /> : <ChevronRight size={18} aria-hidden="true" />}</button>
      </div>

      {error && <ErrorState message={t("cal.loadError")} onRetry={load} />}
      {!data && !error && <p className="text-noor-textMuted text-center" role="status">{t("common.loading")}</p>}
      {data && (
        <>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-noor-textMuted mb-1" aria-hidden="true">{WEEK_IDX.map((w) => <div key={w}>{weekdayShort(locale, w)}</div>)}</div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: offset }).map((_, i) => <div key={`e${i}`} />)}
            {days.map((d) => {
              const fasted = fastDates.has(isoOf(d));
              const white = d.hijriDay >= 13 && d.hijriDay <= 15;
              const label = `${weekdayLong(locale, new Date(year, month - 1, d.gregorianDay))}, ${d.gregorianDay} ${monthName(month)} ${year}. ${d.hijriDay} ${hm(d.hijriMonthNumber, d.hijriMonth)} ${d.hijriYear}.${d.events.length ? ` ${d.events.map((e) => eventName(t, e.name)).join(", ")}.` : ""}${fasted ? ` ${t("cal.fastedWord")}` : ""}`;
              return (
                <button key={d.gregorianDay} onClick={() => setSelected(d.gregorianDay)} aria-label={label} aria-pressed={selected === d.gregorianDay} aria-current={isToday(d) ? "date" : undefined}
                  className={`glass-card p-1.5 min-h-[58px] text-center relative ${d.events.length ? "border-noor-gold" : ""} ${isToday(d) ? "ring-2 ring-noor-goldBright" : ""} ${selected === d.gregorianDay ? "bg-noor-surface2" : ""} ${white ? "border-b-2 border-b-noor-emeraldBright" : ""}`}>
                  <span className="block text-sm">{d.gregorianDay}</span>
                  <span className="block text-[11px] text-noor-goldBright">{d.hijriDay}</span>
                  {d.events.length > 0 && <span className="block w-1.5 h-1.5 mx-auto mt-1 rounded-full bg-noor-goldBright" aria-hidden="true" />}
                  {fasted && <Check size={12} className="absolute top-1 end-1 text-noor-emeraldBright" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-noor-textMuted mt-2">{t("cal.legend")}</p>

          {selectedDay && (
            <GlassCard className="mt-4 space-y-2" aria-live="polite">
              <p className="font-medium">{weekdayLong(locale, new Date(year, month - 1, selectedDay.gregorianDay))}, {selectedDay.gregorianDay} {monthName(month)} {year}</p>
              <p className="text-noor-goldBright">{selectedDay.hijriDay} {hm(selectedDay.hijriMonthNumber, selectedDay.hijriMonth)} {selectedDay.hijriYear}</p>
              {selectedDay.events.map((e, i) => <p key={i} className="text-sm"><strong>{eventName(t, e.name)}</strong> <span className="text-noor-textMuted">— {eventNote(t, e.note)}</span></p>)}
              {selectedDay.hijriDay >= 13 && selectedDay.hijriDay <= 15 && <p className="text-sm text-noor-textMuted">{t("cal.whiteDay")}</p>}
              {user ? (
                isFuture(selectedDay)
                  ? <p className="text-xs text-noor-textMuted">{t("cal.fastLater")}</p>
                  : <button onClick={() => toggleFast(selectedDay)} aria-pressed={selectedFasted} className={`px-4 py-1.5 rounded-full text-sm border ${selectedFasted ? "bg-noor-gold text-noor-onAccent border-noor-gold" : "border-noor-gold text-noor-goldBright hover:bg-noor-surface2"}`}>{selectedFasted ? t("cal.fastedRemove") : t("cal.iFasted")}</button>
              ) : (
                <p className="text-xs text-noor-textMuted"><Link to="/login" className="text-noor-goldBright">{t("nav.login")}</Link> {t("cal.loginRecord")}</p>
              )}
            </GlassCard>
          )}

          <h2 className="text-xl mt-8 mb-3">{t("cal.importantMonth")}</h2>
          <div className="space-y-2">
            {events.flatMap((d) => d.events.map((e, i) => (
              <GlassCard key={`${d.gregorianDay}-${i}`} className="py-3">
                <p className="font-medium">{eventName(t, e.name)}</p>
                <p className="text-xs text-noor-textMuted">{weekdayLong(locale, new Date(year, month - 1, d.gregorianDay))}, {d.gregorianDay} {monthName(month)} • {d.hijriDay} {hm(d.hijriMonthNumber, d.hijriMonth)} — {eventNote(t, e.note)}</p>
              </GlassCard>
            )))}
            {events.length === 0 && <p className="text-noor-textMuted text-sm">{t("cal.noEvents")}</p>}
          </div>
        </>
      )}

      {/* Coming up (next 8 events from today, across months and years) */}
      <h2 className="text-xl mt-10 mb-3">{t("cal.comingUp")}</h2>
      {upcomingError && <p className="text-sm text-noor-textMuted">{t("cal.upcomingError")}</p>}
      {!upcoming && !upcomingError && <p className="text-sm text-noor-textMuted" role="status">{t("common.loading")}</p>}
      {upcoming && (
        <ul className="space-y-2">
          {upcoming.events.map((e) => (
            <li key={`${e.name}-${e.hijriYear}`}>
              <GlassCard className="py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{eventName(t, e.name)}</p>
                  <p className="text-xs text-noor-textMuted">{fmt(e.gregorianDate, true)} • {e.hijriDay} {hm(e.hijriMonthNumber, e.hijriMonthName)} {e.hijriYear} — {eventNote(t, e.note)}</p>
                </div>
                <p className="text-sm text-noor-goldBright whitespace-nowrap">{daysUntilText(t, e.daysUntil)}</p>
              </GlassCard>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-noor-textMuted mt-2">{t("cal.footA")} <Link to="/ramadan" className="text-noor-goldBright">{t("footer.ramadan")}</Link> {t("cal.footB")}</p>

      {/* Converter */}
      <GlassCard className="mt-10 space-y-4">
        <h2 className="text-xl">{t("cal.converter")}</h2>
        <div role="group" aria-label={t("cal.direction")} className="flex gap-2 text-sm">
          <button onClick={() => { setMode("g2h"); setConverted(null); setConvertError(""); }} aria-pressed={mode === "g2h"} className={`px-4 py-1.5 rounded-full border ${mode === "g2h" ? "bg-noor-gold text-noor-onAccent border-noor-gold" : "border-noor-border"}`}>{t("cal.g2h")}</button>
          <button onClick={() => { setMode("h2g"); setConverted(null); setConvertError(""); }} aria-pressed={mode === "h2g"} className={`px-4 py-1.5 rounded-full border ${mode === "h2g" ? "bg-noor-gold text-noor-onAccent border-noor-gold" : "border-noor-border"}`}>{t("cal.h2g")}</button>
        </div>
        <form onSubmit={runConvert} className="flex flex-wrap items-end gap-3 text-sm">
          {mode === "g2h" ? (
            <label className="flex flex-col gap-1">
              <span className="text-noor-textMuted">{t("cal.gDate")}</span>
              <input type="date" value={gDate} onChange={(e) => setGDate(e.target.value)} min="1900-01-01" max="2100-12-31" className={inputClass} />
            </label>
          ) : (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-noor-textMuted">{t("cal.day")}</span>
                <input type="number" min="1" max="30" value={hDay} onChange={(e) => setHDay(e.target.value)} className={`${inputClass} w-20`} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-noor-textMuted">{t("cal.month")}</span>
                <select value={hMonth} onChange={(e) => setHMonth(Number(e.target.value))} className={inputClass}>
                  {HIJRI_IDX.map((n) => <option key={n} value={n}>{n} · {t(`hm.${n}`)}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-noor-textMuted">{t("cal.year")}</span>
                <input type="number" min="1300" max="1700" value={hYear} onChange={(e) => setHYear(e.target.value)} className={`${inputClass} w-24`} />
              </label>
            </>
          )}
          <button type="submit" disabled={converting} className="px-5 py-1.5 rounded-full bg-noor-gold text-noor-onAccent font-medium hover:bg-noor-goldBright disabled:opacity-50">{converting ? t("cal.converting") : t("cal.convert")}</button>
        </form>
        <div aria-live="polite">
          {convertError && <p role="alert" className="text-sm text-red-300">{convertError}</p>}
          {converted && (
            <div className="space-y-1">
              {mode === "g2h" ? (
                <p className="text-lg">{fmt(converted.gregorian.date, true)} = <strong className="text-noor-goldBright">{hijriText(converted.hijri)}</strong></p>
              ) : (
                <p className="text-lg">{hijriText(converted.hijri)} = <strong className="text-noor-goldBright">{fmt(converted.gregorian.date, true)}</strong></p>
              )}
              <p className="text-xs text-noor-textMuted">{converted.note === "Calculated date. The real start of a Hijri month depends on moon sighting." ? t("cal.convNote") : converted.note}</p>
            </div>
          )}
        </div>
      </GlassCard>
    </div>
  );
}
