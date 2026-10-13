import React, { useCallback, useEffect, useRef, useState } from "react";
import { Palette, Check } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { useI18n } from "../context/I18nContext";
import { bgFile } from "../theme/themeMedia";

// Small preview of a theme: its background picture with the card + accent colours along the bottom
function Swatch({ id, c }) {
  return (
    <span className="theme-swatch relative !w-14 !h-9 !rounded-lg" aria-hidden="true" style={{ background: c.bg }}>
      <img src={bgFile(id, true)} alt="" loading="lazy" decoding="async" width="56" height="36" className="absolute inset-0 w-full h-full object-cover" />
      <span className="absolute inset-x-0 bottom-0 h-2 flex">
        <i style={{ background: c.surface }} />
        <i style={{ background: c.surface2 }} />
        <i style={{ background: c.gold }} />
      </span>
    </span>
  );
}

// Navbar (and admin header) button: opens a menu with every theme. Saved on this device.
// Keyboard: Enter/Space/ArrowDown opens, arrows move, Enter picks, Escape closes.
export default function ThemeSwitcher({ className = "", iconSize = 18 }) {
  const { theme, themes, setTheme } = useTheme();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const wrap = useRef(null);
  const btn = useRef(null);
  const items = useRef([]);

  const close = useCallback((refocus) => {
    setOpen(false);
    if (refocus && btn.current) btn.current.focus();
  }, []);

  // click outside / Escape
  useEffect(() => {
    if (!open) return undefined;
    function onDown(e) { if (wrap.current && !wrap.current.contains(e.target)) close(false); }
    function onKey(e) { if (e.key === "Escape") { e.stopPropagation(); close(true); } }
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey, true); };
  }, [open, close]);

  // focus the active theme when the menu opens
  useEffect(() => {
    if (!open) return;
    const i = Math.max(0, themes.findIndex((x) => x.id === theme.id));
    items.current[i]?.focus();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  function onMenuKey(e) {
    const idx = items.current.findIndex((el) => el === document.activeElement);
    const n = themes.length;
    let next = null;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") next = (idx + 1) % n;
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft") next = (idx - 1 + n) % n;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = n - 1;
    if (next !== null) { e.preventDefault(); items.current[next]?.focus(); }
  }

  return (
    <div ref={wrap} className={`relative ${className}`}>
      <button
        ref={btn}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${t("theme.change")}: ${t(`theme.${theme.id}`)}`}
        title={t("theme.change")}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => { if (e.key === "ArrowDown" && !open) { e.preventDefault(); setOpen(true); } }}
        className="flex items-center gap-2 p-2 rounded-full hover:bg-noor-surface2 text-noor-text"
      >
        <Palette size={iconSize} aria-hidden="true" />
        <span className="w-3 h-3 rounded-full border border-noor-border" style={{ background: theme.c.gold }} aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={t("theme.label")}
          onKeyDown={onMenuKey}
          className="absolute end-0 top-full mt-2 w-72 max-w-[88vw] z-50 rounded-2xl border border-noor-border bg-noor-surface p-2 shadow-glow backdrop-blur-md"
        >
          <p className="px-2 pt-1 pb-2 text-xs font-semibold text-noor-textMuted">{t("theme.label")}</p>
          <ul className="flex flex-col gap-0.5 max-h-[calc(100dvh-9rem)] overflow-y-auto overscroll-contain">
            {themes.map((th, i) => {
              const on = th.id === theme.id;
              return (
                <li key={th.id}>
                  <button
                    ref={(el) => { items.current[i] = el; }}
                    type="button"
                    role="menuitemradio"
                    aria-checked={on}
                    onClick={() => { setTheme(th.id); close(true); }}
                    className={`w-full flex items-center gap-3 px-2 py-2 rounded-xl text-sm text-start transition-colors ${on ? "bg-noor-surface2 text-noor-goldBright" : "text-noor-text hover:bg-noor-surface2"}`}
                  >
                    <Swatch id={th.id} c={th.c} />
                    <span className="flex-1">{th.icon} {t(`theme.${th.id}`)}</span>
                    {on && <Check size={16} aria-hidden="true" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
