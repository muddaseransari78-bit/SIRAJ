import { useCallback, useEffect, useState } from "react";

const LOCATION_KEY = "siraj_location"; // same key the Prayer page uses: one chosen place for the whole app

function readSavedCity() {
  try {
    const saved = JSON.parse(localStorage.getItem(LOCATION_KEY) || "null");
    return saved && saved.city && saved.country ? { mode: "city", city: saved.city, country: saved.country } : null;
  } catch (e) { return null; }
}

/** Query parameters the backend understands for a place: { lat, lng } or { city, country }. */
export function placeParams(place) {
  if (!place) return null;
  return place.mode === "city" ? { city: place.city, country: place.country } : { lat: place.lat, lng: place.lng };
}

/** Short text to show the person, e.g. "Lahore, Pakistan" or "31.52, 74.36". */
export function placeLabel(place) {
  if (!place) return "";
  return place.mode === "city" ? `${place.city}, ${place.country}` : `${place.lat.toFixed(2)}, ${place.lng.toFixed(2)}`;
}

/**
 * Where is the person? A city saved on this device wins (no permission popup);
 * otherwise the browser location is asked; if that is refused `status` becomes "denied"
 * and the page should show a city form (or use `fallbackCity` from the account).
 */
export default function usePlace(fallbackCity) {
  const [place, setPlace] = useState(readSavedCity);
  const [status, setStatus] = useState(place ? "ok" : "idle"); // idle | asking | ok | denied

  const locate = useCallback(() => {
    if (!navigator.geolocation) { setStatus("denied"); return; }
    setStatus("asking");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        try { localStorage.removeItem(LOCATION_KEY); } catch (e) { /* ignore */ }
        setPlace({ mode: "coords", lat: p.coords.latitude, lng: p.coords.longitude });
        setStatus("ok");
      },
      () => setStatus("denied"),
      { timeout: 15000, maximumAge: 10 * 60 * 1000 }
    );
  }, []);

  useEffect(() => {
    if (!place) locate();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Refused + the account has a saved city -> use that one
  useEffect(() => {
    if (status === "denied" && !place && fallbackCity && fallbackCity.city && fallbackCity.country) {
      setPlace({ mode: "city", city: fallbackCity.city, country: fallbackCity.country });
      setStatus("ok");
    }
  }, [status, place, fallbackCity]);

  const setCity = useCallback((city, country) => {
    const c = String(city || "").trim();
    const k = String(country || "").trim();
    if (!c || !k) return false;
    try { localStorage.setItem(LOCATION_KEY, JSON.stringify({ city: c, country: k })); } catch (e) { /* ignore */ }
    setPlace({ mode: "city", city: c, country: k });
    setStatus("ok");
    return true;
  }, []);

  return { place, status, locate, setCity };
}
