import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { THEMES, DEFAULT_THEME, THEME_KEY, THEME_MAP, getTheme } from "../theme/themes";

const ThemeContext = createContext(null);

function readSaved() {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return THEME_MAP[v] ? v : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

// Writes the theme onto <html>. CSS (src/theme/themes.css + index.css) does the rest.
function applyTheme(theme) {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme.id);
  root.setAttribute("data-mode", theme.mode);
  root.style.colorScheme = theme.mode;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme.c.bg);
}

// <ThemeProvider> wraps the app (main.jsx).  const { theme, setTheme, themes } = useTheme();
export function ThemeProvider({ children }) {
  const [themeId, setThemeId] = useState(readSaved);
  const timer = useRef(null);
  const theme = getTheme(themeId);

  useEffect(() => { applyTheme(theme); }, [theme]);

  const setTheme = useCallback((id) => {
    if (!THEME_MAP[id]) return;
    const root = document.documentElement;
    root.classList.add("theme-anim"); // smooth colour fade for ~0.4s
    clearTimeout(timer.current);
    timer.current = setTimeout(() => root.classList.remove("theme-anim"), 450);
    setThemeId(id);
    try { localStorage.setItem(THEME_KEY, id); } catch { /* storage blocked: theme still changes for this visit */ }
  }, []);

  // Another tab changed the theme -> follow it
  useEffect(() => {
    function onStorage(e) {
      if (e.key === THEME_KEY && THEME_MAP[e.newValue]) setThemeId(e.newValue);
    }
    window.addEventListener("storage", onStorage);
    return () => { window.removeEventListener("storage", onStorage); clearTimeout(timer.current); };
  }, []);

  const value = useMemo(() => ({ theme, themeId, setTheme, themes: THEMES, isLight: theme.mode === "light" }), [theme, themeId, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
