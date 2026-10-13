import React, { useCallback, useEffect, useRef, useState } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import { AnimatePresence, motion, useScroll, useSpring } from "framer-motion";
import { Menu, X, Search, User, BookOpen, Home as HomeIcon, Clock, Compass, Moon, CalendarDays, Tag, MessageSquare, ChevronLeft, ChevronRight, BookText, CircleDot, Heart } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import LanguageSwitcher from "./LanguageSwitcher";
import ThemeSwitcher from "./ThemeSwitcher";
import NotificationBell from "./NotificationBell";
import SearchDialog from "./SearchDialog";
import { logoFile } from "../theme/themeMedia";
import { useTheme } from "../context/ThemeContext";

// ONE navbar, no "More" menu: every page is a link in one line. When the screen is too narrow for all of them the line
// slides sideways (mouse wheel, drag with the mouse, touch swipe or the small arrows) and the page you are on is
// brought into view by itself. The soft fade at the edges shows that there is more to see.
const MAIN_LINKS = [
  { to: "/", label: "nav.home" },
  { to: "/quran", label: "nav.quran" },
  { to: "/hadith", label: "nav.hadith" },
  { to: "/prayer", label: "nav.prayer" },
  { to: "/qibla", label: "nav.qibla" },
  { to: "/recitation/live", label: "nav.recite" },
];

export const MORE_LINKS = [
  { to: "/tafseer", label: "nav.tafseer", Icon: BookText },
  { to: "/tasbeeh", label: "nav.tasbeeh", Icon: CircleDot },
  { to: "/duas", label: "nav.duas", Icon: Heart },
  { to: "/ramadan", label: "nav.ramadan", Icon: Moon },
  { to: "/calendar", label: "nav.calendar", Icon: CalendarDays },
  { to: "/topics", label: "nav.topics", Icon: Tag },
  { to: "/assistant", label: "nav.sourceFinder", Icon: Search },
  { to: "/feedback", label: "nav.feedback", Icon: MessageSquare },
];

// the phone menu lists everything in one scrolling list
const ALL_LINKS = [...MAIN_LINKS, ...MORE_LINKS];

const MOBILE_TABS = [
  { to: "/", label: "nav.home", Icon: HomeIcon },
  { to: "/quran", label: "nav.quran", Icon: BookOpen },
  { to: "/prayer", label: "nav.prayer", Icon: Clock },
  { to: "/qibla", label: "nav.qibla", Icon: Compass },
  { to: "/dashboard", label: "nav.profile", Icon: User },
];

const IS_MAC = typeof navigator !== "undefined" && /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent || "");

// True while the user is typing in a field (so "/" must stay a normal character)
function isTypingTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

// The desktop link line: all pages in one row that fits the bar and slides sideways when it is too long.
function NavStrip() {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const ref = useRef(null);
  const drag = useRef({ down: false, x: 0, left: 0, moved: false });
  const [edge, setEdge] = useState({ left: false, right: false });

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const rtl = getComputedStyle(el).direction === "rtl";
    const min = rtl ? -max : 0;
    const top = rtl ? 0 : max;
    const sl = el.scrollLeft;
    setEdge((old) => {
      const next = { left: max > 4 && sl > min + 4, right: max > 4 && sl < top - 4 };
      return old.left === next.left && old.right === next.right ? old : next;
    });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    let ro;
    if (typeof ResizeObserver !== "undefined") { ro = new ResizeObserver(update); ro.observe(el); }
    // the mouse wheel slides the line sideways while the pointer is over it (the page keeps scrolling once an end is reached)
    const onWheel = (e) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 4) return;
      const rtl = getComputedStyle(el).direction === "rtl";
      const pos = rtl ? -el.scrollLeft : el.scrollLeft; // 0 = start of the line, max = its end
      if ((e.deltaY > 0 && pos >= max - 1) || (e.deltaY < 0 && pos <= 0)) return; // at an end: let the page scroll
      e.preventDefault();
      el.scrollLeft += e.deltaY * (rtl ? -1 : 1);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      el.removeEventListener("wheel", onWheel);
      if (ro) ro.disconnect();
    };
  }, [update]);

  // the open page's link slides into the middle of the line
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const id = requestAnimationFrame(() => {
      const a = el.querySelector('a[aria-current="page"]');
      if (a && a.scrollIntoView) a.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
    });
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  const onPointerDown = (e) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    drag.current = { down: true, x: e.clientX, left: ref.current.scrollLeft, moved: false };
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d.down) return;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > 5) d.moved = true;
    if (d.moved) ref.current.scrollLeft = d.left - dx;
  };
  const endDrag = () => { drag.current.down = false; };
  // a drag must not open the link the mouse was released on
  const onClickCapture = (e) => {
    if (drag.current.moved) { e.preventDefault(); e.stopPropagation(); drag.current.moved = false; }
  };
  const nudge = (dir) => ref.current && ref.current.scrollBy({ left: dir * Math.max(160, ref.current.clientWidth * 0.6), behavior: "smooth" });

  const fade = `linear-gradient(to right, ${edge.left ? "transparent 0, #000 36px" : "#000 0"}, ${edge.right ? "#000 calc(100% - 36px), transparent 100%" : "#000 100%"})`;

  return (
    <div className="relative flex-1 min-w-0 hidden lg:flex items-center">
      {edge.left && (
        <button type="button" aria-label="←" onClick={() => nudge(-1)} className="nav-arrow absolute left-0 z-10 p-1 rounded-full bg-noor-surface/80 border border-noor-border text-noor-textMuted hover:text-noor-goldBright">
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
      )}
      <nav
        ref={ref}
        className="nav-strip flex items-center gap-0.5 xl:gap-1 overflow-x-auto w-full px-1 py-1"
        style={{ WebkitMaskImage: fade, maskImage: fade }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={onClickCapture}
      >
        {ALL_LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === "/"}
            draggable={false}
            className={({ isActive }) =>
              `nav-pill shrink-0 whitespace-nowrap px-3 py-2 text-sm rounded-full transition-all duration-200 ${
                isActive
                  ? "text-noor-onAccent bg-noor-gold shadow-glow"
                  : "text-noor-textMuted hover:text-noor-goldBright hover:bg-noor-surface2/70 hover:-translate-y-px"
              }`
            }
          >
            {t(link.label)}
          </NavLink>
        ))}
      </nav>
      {edge.right && (
        <button type="button" aria-label="→" onClick={() => nudge(1)} className="nav-arrow absolute right-0 z-10 p-1 rounded-full bg-noor-surface/80 border border-noor-border text-noor-textMuted hover:text-noor-goldBright">
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { user } = useAuth();
  const { t } = useI18n();
  const { themeId } = useTheme();
  const { pathname } = useLocation();
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.4 });

  // the bar gets a little smaller and more solid once the page is scrolled
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = 0; setScrolled(window.scrollY > 12); });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); if (raf) cancelAnimationFrame(raf); };
  }, []);

  // the phone menu closes by itself when you open a page or press Escape
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Ctrl/Cmd+K opens (or closes) search from anywhere; "/" opens it when not typing in a field.
  useEffect(() => {
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      } else if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey && !isTypingTarget(e.target)) {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <header className={`glass-nav sticky top-0 z-40 ${scrolled ? "is-scrolled" : ""}`}>
        <div className={`max-w-7xl mx-auto px-3 sm:px-4 flex items-center justify-between gap-2 transition-[height] duration-300 ${scrolled ? "h-14" : "h-16"}`}>
          <Link to="/" className="flex items-center gap-2.5 shrink-0" aria-label="SIRAJ">
            <img id="nav-logo" className="nav-logo h-9 w-9 sm:h-10 sm:w-10 shrink-0 object-contain" src={logoFile(themeId, true)} width="40" height="40" alt="" />
            <span className="font-display text-xl tracking-wide text-noor-goldBright">SIRAJ</span>
          </Link>

          <NavStrip />

          <div className="hidden lg:flex items-center gap-2 xl:gap-3 shrink-0">
            <ThemeSwitcher />
            <LanguageSwitcher />
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label={t("nav.search")}
              aria-haspopup="dialog"
              className="flex items-center gap-2 p-2 xl:px-3 rounded-full hover:bg-noor-surface2"
            >
              <Search size={18} />
              <kbd className="hidden xl:inline text-[11px] text-noor-textMuted border border-noor-border rounded px-1.5 py-0.5">{IS_MAC ? "⌘K" : "Ctrl K"}</kbd>
            </button>
            <NotificationBell />
            {user && ["ADMIN", "SUPER_ADMIN"].includes(user.role) && (
              <Link to="/admin" className="text-xs text-noor-textMuted hover:text-noor-goldBright">{t("nav.admin")}</Link>
            )}
            {user ? (
              <Link
                to="/dashboard"
                className="px-4 py-2 rounded-full border border-noor-gold text-noor-goldBright text-sm hover:bg-noor-surface2"
              >
                {user.name.split(" ")[0]}
              </Link>
            ) : (
              <>
                <Link to="/login" className="text-sm text-noor-textMuted hover:text-noor-text">
                  {t("nav.login")}
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 rounded-full bg-noor-gold text-noor-onAccent text-sm font-medium hover:bg-noor-goldBright"
                >
                  {t("nav.register")}
                </Link>
              </>
            )}
          </div>

          <div className="lg:hidden flex items-center">
            <ThemeSwitcher iconSize={20} />
            <button type="button" className="p-2" aria-label={t("nav.search")} aria-haspopup="dialog" onClick={() => setSearchOpen(true)}>
              <Search size={21} />
            </button>
            <button
              className="p-2"
              aria-label={open ? t("nav.menuClose") : t("nav.menuOpen")}
              onClick={() => setOpen((o) => !o)}
            >
              {open ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* reading-progress line of the page */}
        <motion.div className="scroll-progress" style={{ scaleX: progress }} aria-hidden="true" />

        <AnimatePresence initial={false}>
          {open && (
            <motion.nav
              key="mobile-menu"
              aria-label={t("nav.menuOpen")}
              className="lg:hidden overflow-hidden border-t border-noor-border"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: "easeInOut" }}
            >
              <div className="px-4 pb-4 pt-1 flex flex-col gap-1 max-h-[calc(100dvh-8.5rem)] overflow-y-auto overscroll-contain">
                <LanguageSwitcher className="py-3" />
                {ALL_LINKS.map((link) => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    end={link.to === "/"}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      `px-3 py-3 rounded-xl text-sm transition-colors ${
                        isActive ? "bg-noor-gold/15 ring-1 ring-noor-gold/40 text-noor-goldBright" : "text-noor-textMuted hover:bg-noor-surface2"
                      }`
                    }
                  >
                    {t(link.label)}
                  </NavLink>
                ))}
                {user && (
                  <div className="flex gap-2 pt-2">
                    <Link to="/notifications" onClick={() => setOpen(false)} className="flex-1 text-center py-2.5 rounded-xl border border-noor-border text-sm">{t("notif.title")}</Link>
                    <Link to="/profile" onClick={() => setOpen(false)} className="flex-1 text-center py-2.5 rounded-xl border border-noor-border text-sm">{t("nav.profile")}</Link>
                  </div>
                )}
                {!user && (
                  <div className="flex gap-2 pt-2">
                    <Link to="/login" onClick={() => setOpen(false)} className="flex-1 text-center py-2.5 rounded-xl border border-noor-border">
                      {t("nav.login")}
                    </Link>
                    <Link
                      to="/register"
                      onClick={() => setOpen(false)}
                      className="flex-1 text-center py-2.5 rounded-xl bg-noor-gold text-noor-onAccent font-medium"
                    >
                      {t("nav.register")}
                    </Link>
                  </div>
                )}
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>

      {/* Mobile bottom navigation */}
      <nav aria-label="SIRAJ" className="glass-tabbar lg:hidden fixed bottom-0 left-0 right-0 z-40 flex justify-around px-1 pt-1.5">
        {MOBILE_TABS.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `relative flex-1 max-w-[5.5rem] flex flex-col items-center gap-0.5 py-1.5 text-[11px] leading-tight transition-colors ${
                isActive ? "text-noor-goldBright" : "text-noor-textMuted"
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span
                    layoutId="tabpill"
                    className="absolute inset-x-1 inset-y-0 rounded-2xl bg-noor-gold/15 ring-1 ring-noor-gold/40"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    aria-hidden="true"
                  />
                )}
                <Icon size={21} className="relative" aria-hidden="true" />
                <span className="relative truncate max-w-full">{t(label)}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Outside <header> on purpose: the header's blur would trap a fixed overlay inside it */}
      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
