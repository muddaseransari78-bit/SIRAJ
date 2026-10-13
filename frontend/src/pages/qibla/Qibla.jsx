import React, { useEffect, useMemo, useRef, useState } from "react";
import { Compass, Crosshair, MapPin, Search } from "lucide-react";
import GlassCard from "../../components/GlassCard";
import CompassView, { webglAvailable } from "../../components/CompassView";
import useCompass from "../../hooks/useCompass";
import { searchPlaces } from "../../services/contentService";
import {
  MAX_CORRECTION, cardinal, clampCorrection, distanceToKaabaKm, formatKm, isAligned, qiblaBearing, shortestDelta, turnAdvice,
} from "../../utils/qibla";
import { currentlyLite } from "../../hooks/useLiteMode";
import { useI18n } from "../../context/I18nContext";

const CITIES = [
  { name: "Lahore", lat: 31.5204, lng: 74.3587 },
  { name: "Karachi", lat: 24.8607, lng: 67.0011 },
  { name: "Islamabad", lat: 33.6844, lng: 73.0479 },
  { name: "London", lat: 51.5072, lng: -0.1276 },
  { name: "New York", lat: 40.7128, lng: -74.006 },
  { name: "Dubai", lat: 25.2048, lng: 55.2708 },
];
const LOC_KEY = "siraj_qibla_loc";
const VIEW_KEY = "siraj_compass_view";
const CORRECTION_KEY = "siraj_compass_correction";
const inputClass = "rounded-lg bg-noor-surface2 border border-noor-border px-3 py-2 text-sm w-full";

function readSaved() {
  try {
    const v = JSON.parse(localStorage.getItem(LOC_KEY) || "null");
    return v && Number.isFinite(v.lat) && Number.isFinite(v.lng) ? v : null;
  } catch (e) { return null; }
}

function defaultView() {
  const saved = localStorage.getItem(VIEW_KEY);
  if (saved === "3d" || saved === "flat") return saved;
  // Weak device / Data Saver / reduced motion / "Lite" choice in the footer -> flat view (see hooks/useLiteMode.js)
  return !currentlyLite() && webglAvailable() ? "3d" : "flat";
}

export default function Qibla() {
  const { t } = useI18n();
  const [loc, setLoc] = useState(readSaved); // { lat, lng, name }
  const [geoState, setGeoState] = useState("idle"); // idle | asking | denied
  const [error, setError] = useState("");
  const [view, setView] = useState(defaultView);
  const [showManual, setShowManual] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null); // null = not searched yet
  const [searching, setSearching] = useState(false);
  const [latInput, setLatInput] = useState("");
  const [lngInput, setLngInput] = useState("");
  const [aligned, setAligned] = useState(false);
  const [correction, setCorrection] = useState(() => clampCorrection(localStorage.getItem(CORRECTION_KEY)));
  const compass = useCompass(correction);

  const qibla = loc ? qiblaBearing(loc.lat, loc.lng) : null;
  const distance = loc ? distanceToKaabaKm(loc.lat, loc.lng) : null;
  const live = compass.status === "active" && compass.heading != null;
  const diff = live && qibla != null ? shortestDelta(compass.heading, qibla) : null;

  function chooseLocation(next, remember = true) {
    setLoc(next);
    setError("");
    setShowManual(false);
    if (remember) {
      try { localStorage.setItem(LOC_KEY, JSON.stringify(next)); } catch (e) { /* ignore */ }
    }
  }

  function locateMe() {
    if (!navigator.geolocation) { setGeoState("denied"); setShowManual(true); setError(t("qibla.noGeo")); return; }
    setGeoState("asking"); setError("");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setGeoState("idle");
        try { localStorage.removeItem(LOC_KEY); } catch (e) { /* ignore */ }
        chooseLocation({ lat: p.coords.latitude, lng: p.coords.longitude, name: "__ME__" }, false);
      },
      () => { setGeoState("denied"); setShowManual(true); setError(t("qibla.geoDenied")); },
      { timeout: 15000, maximumAge: 10 * 60 * 1000 }
    );
  }

  useEffect(() => { if (!loc) locateMe(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function runSearch(e) {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 2) return;
    setSearching(true); setError("");
    try {
      setResults(await searchPlaces(q));
    } catch (err) {
      setResults(null);
      setError(err.response?.data?.message || t("qibla.searchFail"));
    } finally { setSearching(false); }
  }

  function useCoordinates(e) {
    e.preventDefault();
    const lat = Number(latInput);
    const lng = Number(lngInput);
    if (latInput.trim() === "" || lngInput.trim() === "" || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      setError(t("qibla.coordsError"));
      return;
    }
    chooseLocation({ lat, lng, name: `${lat.toFixed(3)}, ${lng.toFixed(3)}` });
  }

  // "Aligned" state with hysteresis, plus one short vibration when it starts
  const wasAligned = useRef(false);
  useEffect(() => {
    if (diff == null) { wasAligned.current = false; setAligned(false); return; }
    const next = isAligned(diff, wasAligned.current);
    if (next && !wasAligned.current && navigator.vibrate) navigator.vibrate(60);
    wasAligned.current = next;
    setAligned(next);
  }, [diff]);

  function changeCorrection(value) {
    const next = clampCorrection(value);
    setCorrection(next);
    try { localStorage.setItem(CORRECTION_KEY, String(next)); } catch (e) { /* ignore */ }
  }

  // Keep the phone screen on while the live compass is running (not supported everywhere - then nothing happens)
  const wakeLock = useRef(null);
  useEffect(() => {
    if (!live || !navigator.wakeLock) return undefined;
    let cancelled = false;
    navigator.wakeLock.request("screen").then((lock) => {
      if (cancelled) lock.release().catch(() => {}); else wakeLock.current = lock;
    }).catch(() => {});
    return () => {
      cancelled = true;
      if (wakeLock.current) { wakeLock.current.release().catch(() => {}); wakeLock.current = null; }
    };
  }, [live]);

  function switchView() {
    const next = view === "3d" ? "flat" : "3d";
    setView(next);
    try { localStorage.setItem(VIEW_KEY, next); } catch (e) { /* ignore */ }
  }

  const statusText = useMemo(() => {
    switch (compass.status) {
      case "asking": return t("qibla.st.asking");
      case "waiting": return t("qibla.st.waiting");
      case "denied": return t("qibla.st.denied");
      case "unavailable": return t("qibla.st.unavailable");
      default: return "";
    }
  }, [compass.status, t]);

  return (
    <div className="max-w-xl mx-auto px-4 py-12 text-center">
      <h1 className="text-3xl font-display text-noor-goldBright mb-2">{t("qibla.title")}</h1>
      <p className="text-noor-textMuted mb-6">{t("qibla.subtitle")}</p>

      <GlassCard className="shadow-glow">
        {qibla != null ? (
          <>
            <CompassView mode={view} qibla={qibla} heading={compass.heading} headingRef={compass.headingRef}
              aligned={aligned} onFail={() => setView("flat")} />

            <div className="mt-6" aria-live="polite">
              <p className="text-5xl font-display text-noor-goldBright">{Math.round(qibla)}° <span className="text-2xl text-noor-textMuted">{t(`dir.${cardinal(qibla)}`)}</span></p>
              <p className="text-sm text-noor-textMuted mt-1">{t("qibla.fromNorth", { km: `${Math.round(distance).toLocaleString("en-US")} ${t("qibla.km")}` })}</p>
              {loc?.name && <p className="text-sm text-noor-textMuted flex items-center gap-1 justify-center mt-1"><MapPin size={13} aria-hidden="true" />{loc.name === "__ME__" ? t("qibla.yourLocation") : loc.name}</p>}
              {live && (
                <p className={`mt-3 text-lg font-medium ${aligned ? "text-emerald-400" : "text-noor-goldBright"}`}>
                  {aligned ? t("qibla.facing") : (Math.round(Math.abs(diff)) === 0 ? t("qibla.facingShort") : t(diff > 0 ? "qibla.turnRight" : "qibla.turnLeft", { n: Math.round(Math.abs(diff)) }))}
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="py-10 text-noor-textMuted">
            {geoState === "asking" ? t("qibla.finding") : t("qibla.choose")}
          </div>
        )}

        {error && <p role="alert" className="text-sm text-red-400 mt-3">{error}</p>}
        {statusText && <p role="status" className="text-xs text-noor-textMuted mt-3">{statusText}</p>}

        <div className="flex flex-wrap gap-2 justify-center mt-6">
          <button onClick={locateMe} className="flex items-center gap-2 px-4 py-2 rounded-full bg-noor-gold text-noor-onAccent text-sm font-medium">
            <Crosshair size={14} aria-hidden="true" /> {t("qibla.useMyLocation")}
          </button>
          {compass.status === "active" || compass.status === "waiting" ? (
            <button onClick={compass.stop} className="px-4 py-2 rounded-full border border-noor-gold text-noor-goldBright text-sm">{t("qibla.stopCompass")}</button>
          ) : (
            <button onClick={compass.start} className="flex items-center gap-2 px-4 py-2 rounded-full border border-noor-gold text-noor-goldBright text-sm">
              <Compass size={14} aria-hidden="true" /> {t("qibla.enableCompass")}
            </button>
          )}
          <button onClick={() => setShowManual((v) => !v)} className="px-4 py-2 rounded-full border border-noor-border text-sm">
            {showManual ? t("qibla.close") : t("qibla.choosePlace")}
          </button>
          {qibla != null && (
            <button onClick={switchView} className="px-4 py-2 rounded-full border border-noor-border text-sm">
              {view === "3d" ? t("qibla.simpleView") : t("qibla.view3d")}
            </button>
          )}
        </div>
      </GlassCard>

      {live && (
        <GlassCard className="mt-6 text-start">
          <label htmlFor="correction" className="text-sm text-noor-textMuted flex items-center justify-between">
            <span>{t("qibla.correction")}</span>
            <span className="text-noor-goldBright">{correction > 0 ? `+${correction}` : correction}°</span>
          </label>
          <input id="correction" type="range" min={-MAX_CORRECTION} max={MAX_CORRECTION} step={1} value={correction}
            onChange={(e) => changeCorrection(e.target.value)} className="w-full mt-2 accent-noor-gold" />
          <p className="text-xs text-noor-textMuted mt-2">
            {t("qibla.correctionHelp")}
            {correction !== 0 && <> <button onClick={() => changeCorrection(0)} className="text-noor-goldBright underline">{t("qibla.resetZero")}</button></>}
          </p>
        </GlassCard>
      )}

      {showManual && (
        <GlassCard className="mt-6 text-start space-y-5">
          <form onSubmit={runSearch} className="space-y-2">
            <label htmlFor="place-q" className="text-sm text-noor-textMuted">{t("qibla.searchCity")}</label>
            <div className="flex gap-2">
              <input id="place-q" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("qibla.placePh")} maxLength={80} className={inputClass} />
              <button type="submit" disabled={searching} className="px-4 rounded-lg bg-noor-gold text-noor-onAccent text-sm font-medium flex items-center gap-1">
                <Search size={14} aria-hidden="true" /> {searching ? "…" : t("qibla.search")}
              </button>
            </div>
            {results && results.length === 0 && <p className="text-xs text-noor-textMuted">{t("qibla.noPlace")}</p>}
            {results && results.length > 0 && (
              <ul className="space-y-1">
                {results.map((r) => (
                  <li key={`${r.lat},${r.lng}`}>
                    <button type="button" onClick={() => chooseLocation({ lat: r.lat, lng: r.lng, name: [r.name, r.region, r.country].filter(Boolean).join(", ") })}
                      className="w-full text-start px-3 py-2 rounded-lg bg-noor-surface2 hover:bg-noor-border text-sm">
                      {r.name}{r.region ? `, ${r.region}` : ""} <span className="text-noor-textMuted">— {r.country}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </form>

          <form onSubmit={useCoordinates} className="space-y-2">
            <p className="text-sm text-noor-textMuted">{t("qibla.orCoords")}</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-noor-textMuted">{t("qibla.lat")}
                <input value={latInput} onChange={(e) => setLatInput(e.target.value)} inputMode="decimal" placeholder="31.5204" className={`${inputClass} mt-1`} />
              </label>
              <label className="text-xs text-noor-textMuted">{t("qibla.lng")}
                <input value={lngInput} onChange={(e) => setLngInput(e.target.value)} inputMode="decimal" placeholder="74.3587" className={`${inputClass} mt-1`} />
              </label>
            </div>
            <button type="submit" className="px-4 py-2 rounded-full border border-noor-border text-sm">{t("qibla.useCoords")}</button>
          </form>

          <div>
            <p className="text-sm text-noor-textMuted mb-2">{t("qibla.orCity")}</p>
            <div className="flex flex-wrap gap-2">
              {CITIES.map((c) => (
                <button key={c.name} onClick={() => chooseLocation({ lat: c.lat, lng: c.lng, name: t(`city.${c.name}`) })}
                  className="px-3 py-1.5 rounded-full bg-noor-surface2 text-sm hover:bg-noor-border">{t(`city.${c.name}`)}</button>
              ))}
            </div>
          </div>
        </GlassCard>
      )}

      <div className="text-xs text-noor-textMuted mt-8 space-y-2 text-start">
        <p><strong className="text-noor-text">{t("qibla.how")}</strong> {t("qibla.howText")}</p>
        <p><strong className="text-noor-text">{t("qibla.live")}</strong> {t("qibla.liveText")}</p>
      </div>
    </div>
  );
}
