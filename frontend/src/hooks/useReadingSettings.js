import { useEffect, useState } from "react";

const KEY = "siraj_reading_settings";

export const ARABIC_FONTS = [
  { id: "naskh", label: "Naskh", css: '"Noto Naskh Arabic", serif' },
  { id: "amiri", label: "Amiri", css: '"Amiri", serif' },
  { id: "scheherazade", label: "Scheherazade", css: '"Scheherazade New", serif' },
];

const DEFAULTS = {
  fontSize: 28,
  arabicFont: "naskh",
  showEnglish: true,
  showUrdu: false,
  showTransliteration: false,
  showTajweed: false,
  mushafView: false, // flowing Mushaf-style text in Juz / Page / Hizb / Ruku views
  theme: "dark", // "dark" | "soft"
};

// Reading preferences are remembered in this browser (not sensitive data).
export default function useReadingSettings() {
  const [settings, setSettings] = useState(() => {
    try {
      return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
    } catch {
      return DEFAULTS;
    }
  });

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(settings));
  }, [settings]);

  function update(patch) {
    setSettings((prev) => ({ ...prev, ...patch }));
  }

  return [settings, update];
}
