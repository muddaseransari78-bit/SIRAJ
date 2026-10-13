import { useEffect, useState } from "react";
import { fetchTajweed } from "../services/quranService";

const MAX_SURAHS = 6;

/**
 * Loads Tajweed-marked text for the given Surah numbers, only while the setting is on.
 * Returns { map, status } - map["2:255"] = marked text; status = "off" | "loading" | "ready" | "error" | "toomany".
 * The normal Arabic text keeps working if this fails.
 */
export default function useTajweed(enabled, surahNumbers) {
  const [map, setMap] = useState({});
  const [status, setStatus] = useState("off");
  const key = [...new Set(surahNumbers)].sort((a, b) => a - b).join(",");

  useEffect(() => {
    if (!enabled || !key) { setStatus("off"); return undefined; }
    const list = key.split(",").map(Number);
    if (list.length > MAX_SURAHS) { setStatus("toomany"); return undefined; }
    let cancelled = false;
    setStatus("loading");
    Promise.all(list.map((n) => fetchTajweed(n)))
      .then((all) => {
        if (cancelled) return;
        const next = {};
        all.forEach((t) => t.ayahs.forEach((a) => { next[`${t.surahNumber}:${a.numberInSurah}`] = a.text; }));
        setMap(next);
        setStatus("ready");
      })
      .catch(() => { if (!cancelled) setStatus("error"); });
    return () => { cancelled = true; };
  }, [enabled, key]);

  return { map, status };
}
