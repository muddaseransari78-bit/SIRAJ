import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  BookOpen,
  Clock,
  Compass,
  Sparkles,
  Heart,
  CalendarDays,
  ScrollText,
  Moon,
  Tag,
  Search,
  MessageSquare,
  Headphones,
  ChevronDown,
  ChevronRight,
  UserPlus,
} from "lucide-react";
import GlassCard from "../../components/GlassCard";
import DailyDua from "../../components/DailyDua";
import TiltCard from "../../components/dashboard/TiltCard";
import { calcParams } from "../../utils/prayerCalc";
import { fmt12, nextPrayer } from "../../utils/prayerSchedule";
import { loadPrayerTimes } from "../../services/prayerTimes";
import { useAuth } from "../../context/AuthContext";
import { fetchProgress, fetchHadithOfTheDay, fetchAnnouncements, fetchReminderOfTheDay } from "../../services/contentService";
import { plain } from "../../utils/text";
import { useI18n } from "../../context/I18nContext";
import useLiteMode from "../../hooks/useLiteMode";
import ErrorBoundary from "../../components/ErrorBoundary";
import { StatsBand, FeatureSpotlights, HowItWorks } from "../../components/home/HomeSections";
import useSpotlight from "../../hooks/useSpotlight";
import { HERO_POSTER, HERO_POSTER_SMALL, logoFile, pickHeroVideo } from "../../theme/themeMedia";
import { useTheme } from "../../context/ThemeContext";
import { surahPath } from "../../utils/surahSlugs";

import { localDateDMY } from "../../utils/date";
const QUICK_ACCESS = [
  { to: "/quran", label: "nav.quran", Icon: BookOpen },
  { to: "/hadith", label: "nav.hadith", Icon: ScrollText },
  { to: "/tafseer", label: "nav.tafseer", Icon: Sparkles },
  { to: "/prayer", label: "nav.prayer", Icon: Clock },
  { to: "/qibla", label: "nav.qibla", Icon: Compass },
  { to: "/tasbeeh", label: "nav.tasbeeh", Icon: Heart },
  { to: "/duas", label: "nav.duas", Icon: Heart },
  { to: "/calendar", label: "nav.calendar", Icon: CalendarDays },
];

// Phase 30: "scroll below" section with every feature, a short line each
const EXPLORE_MORE = [
  { to: "/ramadan", title: "nav.ramadan", desc: "home.explore.ramadan", Icon: Moon },
  { to: "/calendar", title: "nav.calendar", desc: "home.explore.calendar", Icon: CalendarDays },
  { to: "/topics", title: "nav.topics", desc: "home.explore.topics", Icon: Tag },
  { to: "/assistant", title: "nav.sourceFinder", desc: "home.explore.sourceFinder", Icon: Search },
  { to: "/quran/page/1?view=mushaf", title: "home.explore.mushafTitle", desc: "home.explore.mushaf", Icon: BookOpen },
  { to: `${surahPath(1)}?play=1`, title: "home.explore.audioTitle", desc: "home.explore.audio", Icon: Headphones },
  { to: "/feedback", title: "nav.feedback", desc: "home.explore.feedback", Icon: MessageSquare },
];

function PrayerCountdown() {
  const { t } = useI18n();
  const [prayer, setPrayer] = useState(null);
  const [error, setError] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!navigator.geolocation) {
      setError(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          setPrayer(await loadPrayerTimes({ lat: pos.coords.latitude, lng: pos.coords.longitude, date: localDateDMY(), ...calcParams() }));
        } catch (e) {
          setError(true);
        }
      },
      () => setError(true),
      { timeout: 15000, maximumAge: 10 * 60 * 1000 }
    );
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Use the translated prayer name when we have one, otherwise the name from the API
  const prayerLabel = (name) => {
    const translated = t(`prayerName.${name}`);
    return translated === `prayerName.${name}` ? name : translated;
  };

  if (error) {
    return (
      <GlassCard>
        <p className="text-sm text-noor-textMuted">
          {t("home.prayerEnable")}
        </p>
        <Link to="/prayer" className="inline-block mt-3 px-4 py-2 rounded-full bg-noor-surface2 text-sm hover:bg-noor-border">{t("nav.prayer")}</Link>
      </GlassCard>
    );
  }
  if (!prayer) {
    return (
      <GlassCard className="animate-pulse">
        <p className="text-sm text-noor-textMuted">{t("home.prayerLoading")}</p>
      </GlassCard>
    );
  }

  const next = nextPrayer(prayer, now);
  const diff = next ? Math.max(0, next.at - now) : 0;
  const p2 = (n) => String(n).padStart(2, "0");
  const countdown = `${p2(Math.floor(diff / 3600000))}:${p2(Math.floor((diff % 3600000) / 60000))}:${p2(Math.floor((diff % 60000) / 1000))}`;

  return (
    <GlassCard className="shadow-glow">
      <p className="text-xs uppercase tracking-wide text-noor-textMuted mb-1">{t("home.today")}</p>
      <p className="text-sm text-noor-goldBright mb-3">{prayer.hijriDate}</p>
      {next && (
        <div className="text-center mb-4">
          <p className="text-xs text-noor-textMuted">{t("pr.next")}</p>
          <p className="text-2xl font-display text-noor-goldBright">{prayerLabel(next.name)}</p>
          <p className="text-3xl font-display" dir="ltr">{countdown}</p>
        </div>
      )}
      <div className="grid grid-cols-3 gap-3 text-sm">
        {["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"].map((name) => (
          <div key={name} className="text-center">
            <p className="text-noor-textMuted text-xs">{prayerLabel(name)}</p>
            <p className={`font-medium ${next && next.name === name ? "text-noor-goldBright" : ""}`}>{fmt12(prayer.timings[name])}</p>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}


function ContinueReading() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [progress, setProgress] = useState(null);
  useEffect(() => {
    if (user) fetchProgress().then(setProgress).catch(() => {});
  }, [user]);
  const surah = progress?.lastSurahNumber || 1;
  const ayah = progress?.lastAyahNumber || 1;
  return (
    <GlassCard>
      <p className="text-xs uppercase tracking-wide text-noor-textMuted mb-2">{t("home.continueReading")}</p>
      <p className="text-lg font-medium mb-4">
        {user ? t("home.surahAyah", { s: surah, a: ayah }) : t("home.startReading")}
      </p>
      <Link to={`/quran/${surah}?ayah=${ayah}`} className="inline-block px-4 py-2 rounded-full bg-noor-surface2 text-sm hover:bg-noor-border">
        {user ? t("home.resume") : t("home.openQuran")}
      </Link>
    </GlassCard>
  );
}

function Announcements() {
  const [items, setItems] = useState([]);
  useEffect(() => { fetchAnnouncements().then(setItems).catch(() => {}); }, []);
  if (!items.length) return null;
  return (
    <div className="space-y-3">
      {items.map((a) => (
        <GlassCard key={a._id} className="border-noor-gold/50">
          <p className="font-medium text-noor-goldBright">{a.title}</p>
          <p className="text-sm text-noor-textMuted mt-1">{a.body}</p>
        </GlassCard>
      ))}
    </div>
  );
}

function ReminderOfTheDay() {
  const { t } = useI18n();
  const [r, setR] = useState(null);
  useEffect(() => { fetchReminderOfTheDay().then(setR).catch(() => {}); }, []);
  if (!r) return null;
  return (
    <GlassCard className="border-noor-gold/40">
      <p className="text-xs uppercase tracking-wide text-noor-textMuted mb-2">{t("home.reminder")}</p>
      <p dir="auto" className="text-lg leading-relaxed">{r.text}</p>
      <p className="text-xs text-noor-goldBright mt-3">{r.source}</p>
    </GlassCard>
  );
}

function HadithOfTheDay() {
  const { t } = useI18n();
  const [h, setH] = useState(null);
  useEffect(() => { fetchHadithOfTheDay().then(setH).catch(() => {}); }, []);
  if (!h) return null;
  return (
    <GlassCard>
      <p className="text-xs uppercase tracking-wide text-noor-textMuted mb-3">{t("home.hadithOfDay")}</p>
      <p dir="rtl" className="font-arabic text-xl text-right leading-loose mb-3">{plain(h.ar).slice(0, 300)}</p>
      <p dir="ltr" lang="en" className="text-noor-textMuted text-sm">{plain(h.en).slice(0, 400)}</p>
      <p className="text-xs text-noor-goldBright mt-3 capitalize">
        {t("home.hadithRef", { c: h.collection, b: h.bookNumber, n: h.hadithNumber })}
      </p>
    </GlassCard>
  );
}

// ---------------------------------------------------------------------------------------------
// Phase 36 hero: the Quran video plays behind the title. The "SIRAJ 3D" scene was removed.
//  - Three video sizes (phone / tablet / desktop) so phones never download the big file.
//  - Poster picture shows first and stays when video is off (Lite mode, Data Saver, reduced motion, autoplay blocked).
//  - Video pauses when it is off screen or the tab is hidden (saves battery).
// ---------------------------------------------------------------------------------------------
function HeroMedia({ allowVideo }) {
  const videoRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const src = useMemo(() => {
    if (typeof window === "undefined") return "";
    const conn = navigator.connection || {};
    return pickHeroVideo(window.innerWidth, { saveData: Boolean(conn.saveData) });
  }, []);
  const showVideo = allowVideo && !failed && Boolean(src);

  useEffect(() => {
    const v = videoRef.current;
    if (!showVideo || !v) return undefined;
    v.muted = true; // autoplay is only allowed for muted video (iPhone too)
    const play = () => { const p = v.play(); if (p && p.catch) p.catch(() => {}); };
    const pause = () => { try { v.pause(); } catch { /* ignore */ } };
    let visible = true;
    const sync = () => { if (visible && !document.hidden) play(); else pause(); };
    let io;
    if (typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; sync(); }, { threshold: 0.05 });
      io.observe(v);
    }
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => { if (io) io.disconnect(); document.removeEventListener("visibilitychange", sync); };
  }, [showVideo]);

  return (
    <div className="hero-media" aria-hidden="true">
      <picture>
        <source media="(max-width: 767px)" srcSet={HERO_POSTER_SMALL} type="image/webp" />
        <img src={HERO_POSTER} alt="" decoding="async" fetchpriority="high" />
      </picture>
      {showVideo && (
        <video
          ref={videoRef}
          className={`hero-video ${ready ? "is-ready" : ""}`}
          src={src}
          muted
          loop
          autoPlay
          playsInline
          preload="auto"
          disablePictureInPicture
          disableRemotePlayback
          onPlaying={() => setReady(true)}
          onCanPlay={() => setReady(true)}
          onError={() => setFailed(true)}
        />
      )}
      <div className="hero-scrim" />
    </div>
  );
}

function Hero({ lite }) {
  const { t } = useI18n();
  const { themeId } = useTheme();
  const ref = useRef(null);
  const { scrollY } = useScroll();
  // while you scroll the picture drifts slower than the page, and the title fades and lifts away
  const mediaY = useTransform(scrollY, [0, 700], [0, 110]);
  const contentY = useTransform(scrollY, [0, 500], [0, -50]);
  const contentOpacity = useTransform(scrollY, [0, 420], [1, 0.1]);
  const reduced = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <section ref={ref} className="relative min-h-[calc(100svh-7rem)] overflow-hidden flex items-center" aria-labelledby="hero-title">
      <motion.div className="absolute inset-0" style={lite ? undefined : { y: mediaY }}>
        <ErrorBoundary fallback={null}>
          <HeroMedia allowVideo={!lite && !reduced} />
        </ErrorBoundary>
      </motion.div>

      <motion.div
        style={lite ? undefined : { y: contentY, opacity: contentOpacity }}
        className="relative z-10 w-full max-w-3xl mx-auto px-4 pt-10 pb-28 sm:pb-24 text-center"
      >
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.9, ease: [0.2, 0.7, 0.2, 1] }}
          className="hero-panel rounded-[1.75rem] sm:rounded-[2.25rem] px-5 py-8 sm:px-10 sm:py-12"
        >
          <motion.img
            src={logoFile(themeId)}
            alt=""
            width="768"
            height="768"
            decoding="async"
            initial={{ opacity: 0, scale: 0.6, rotateY: -50 }}
            animate={{ opacity: 1, scale: 1, rotateY: 0 }}
            transition={{ delay: 0.15, duration: 1, type: "spring", stiffness: 90, damping: 14 }}
            className="hero-logo mx-auto h-32 w-32 sm:h-44 sm:w-44 md:h-52 md:w-52 object-contain"
          />
          <motion.h1
            id="hero-title"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="gold-text no-halo font-display text-5xl sm:text-6xl md:text-7xl mt-4 tracking-[0.18em] ps-[0.18em]"
            dir="ltr"
          >
            SIRAJ
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.45 }}
            className="text-noor-text/90 text-base sm:text-lg md:text-xl mt-3 mb-7 max-w-xl mx-auto"
          >
            {t("brand.tagline")}
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="flex flex-col min-[420px]:flex-row gap-3 sm:gap-4 justify-center"
          >
            <Link
              to="/quran"
              className="px-7 py-3 rounded-full bg-noor-gold text-noor-onAccent font-medium shadow-glow hover:bg-noor-goldBright hover:-translate-y-0.5 transition-all"
            >
              {t("hero.exploreQuran")}
            </Link>
            <Link
              to="/hadith"
              className="px-7 py-3 rounded-full border border-noor-gold text-noor-goldBright bg-noor-surface/40 hover:bg-noor-surface2 hover:-translate-y-0.5 transition-all"
            >
              {t("hero.exploreHadith")}
            </Link>
          </motion.div>
        </motion.div>
      </motion.div>

      <a href="#today" className="absolute bottom-24 lg:bottom-6 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center text-xs text-noor-text/80 hover:text-noor-goldBright" aria-label={t("home.scrollDown")}>
        <span className="hidden sm:block mb-1">{t("home.scrollDown")}</span>
        <ChevronDown size={26} className="scroll-cue" aria-hidden="true" />
      </a>
    </section>
  );
}

// Fades and lifts into place when it scrolls into view; children can use `item` variants to appear one by one.
const group = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const item = { hidden: { opacity: 0, y: 26, scale: 0.97 }, show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.55, ease: [0.2, 0.7, 0.2, 1] } } };

function Section({ id, className = "", children }) {
  return (
    <motion.div
      id={id}
      className={`scroll-mt-24 ${className}`}
      initial={{ opacity: 0, y: 36 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      transition={{ duration: 0.7, ease: [0.2, 0.7, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}

function CallToAction() {
  const { t } = useI18n();
  const { themeId } = useTheme();
  const { user } = useAuth();
  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.97 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      transition={{ duration: 0.8, ease: [0.2, 0.7, 0.2, 1] }}
      className="glass-card relative overflow-hidden text-center px-5 py-10 sm:px-10 sm:py-14 shadow-glow"
      data-no-reveal
    >
      <div className="absolute inset-0 geo-pattern opacity-[0.12]" aria-hidden="true" />
      <img src={logoFile(themeId)} alt="" width="120" height="120" loading="lazy" decoding="async" className="hero-logo relative mx-auto h-24 w-24 sm:h-28 sm:w-28 object-contain" />
      <h2 className="relative text-2xl sm:text-4xl mt-4 mb-3 text-noor-goldBright">{t("home.cta.title")}</h2>
      <p className="relative text-noor-textMuted max-w-xl mx-auto mb-7">{t("home.cta.body")}</p>
      <div className="relative flex flex-col min-[420px]:flex-row gap-3 justify-center">
        <Link to="/quran" className="px-7 py-3 rounded-full bg-noor-gold text-noor-onAccent font-medium hover:bg-noor-goldBright hover:-translate-y-0.5 transition-all inline-flex items-center justify-center gap-2">
          <BookOpen size={18} aria-hidden="true" /> {t("home.cta.start")}
        </Link>
        {!user && (
          <Link to="/register" className="px-7 py-3 rounded-full border border-noor-gold text-noor-goldBright hover:bg-noor-surface2 hover:-translate-y-0.5 transition-all inline-flex items-center justify-center gap-2">
            <UserPlus size={18} aria-hidden="true" /> {t("home.cta.join")}
          </Link>
        )}
      </div>
    </motion.div>
  );
}

export default function Home() {
  // Lite mode = reduced-motion setting, Data Saver, weak device, or the footer choice (hooks/useLiteMode.js)
  const { lite } = useLiteMode();
  const { t } = useI18n();
  const rootRef = useRef(null);
  useSpotlight(rootRef); // cards glow where the mouse is

  return (
    <div ref={rootRef}>
      <Hero lite={lite} />

      <section className="max-w-7xl mx-auto px-4 py-12 sm:py-16 space-y-14 sm:space-y-20">
        {/* Prayer countdown + continue reading */}
        <Section id="today">
          <div className="grid md:grid-cols-2 gap-5 sm:gap-6">
            <div data-reveal="left"><PrayerCountdown /></div>
            <div data-reveal="right"><ContinueReading /></div>
          </div>
        </Section>

        <Announcements />

        <Section>
          <DailyDua />
        </Section>

        <ReminderOfTheDay />

        <HadithOfTheDay />

        {/* Numbers that count up */}
        <StatsBand />

        {/* Quick access grid */}
        <Section>
          <h2 className="section-title text-2xl sm:text-3xl mb-6">{t("home.quickAccess")}</h2>
          <motion.div variants={group} initial="hidden" whileInView="show" viewport={{ once: true, margin: "0px 0px -8% 0px" }} className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {QUICK_ACCESS.map(({ to, label, Icon }) => (
              <motion.div key={to} variants={item}>
                <Link to={to} className="block h-full">
                  <TiltCard className="fx-card flex h-full flex-col items-center justify-center gap-3 py-7 sm:py-8 px-4 sm:px-6" data-no-reveal>
                    <span className="fx-icon grid place-items-center h-14 w-14 rounded-2xl bg-noor-gold/15 ring-1 ring-noor-gold/30">
                      <Icon size={28} className="text-noor-goldBright" aria-hidden="true" />
                    </span>
                    <span className="text-sm sm:text-base font-medium text-center">{t(label)}</span>
                  </TiltCard>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </Section>

        {/* Feature sections: what SIRAJ does, with small animated pictures */}
        <Section>
          <h2 className="section-title text-2xl sm:text-3xl mb-2">{t("home.why.title")}</h2>
          <p className="text-noor-textMuted text-sm mb-8 sm:mb-10">{t("home.why.subtitle")}</p>
          <FeatureSpotlights quranHref="/quran" />
        </Section>

        {/* Three simple steps */}
        <Section>
          <h2 className="section-title text-2xl sm:text-3xl mb-6">{t("home.how.title")}</h2>
          <HowItWorks />
        </Section>

        {/* More to explore: Ramadan, Calendar, Quran Topics, Source Finder, Mushaf text, Quran audio, Feedback */}
        <Section>
          <h2 className="section-title text-2xl sm:text-3xl mb-2">{t("home.explore.title")}</h2>
          <p className="text-noor-textMuted text-sm mb-6">{t("home.explore.subtitle")}</p>
          <motion.div variants={group} initial="hidden" whileInView="show" viewport={{ once: true, margin: "0px 0px -8% 0px" }} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {EXPLORE_MORE.map(({ to, title, desc, Icon }) => (
              <motion.div key={to} variants={item}>
                <Link to={to} className="glass-card fx-card h-full p-5 flex items-start gap-4" data-no-reveal>
                  <span className="fx-icon grid place-items-center h-12 w-12 shrink-0 rounded-2xl bg-noor-gold/15 ring-1 ring-noor-gold/30">
                    <Icon size={24} className="text-noor-goldBright" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-lg">{t(title)}</span>
                    <span className="block text-sm text-noor-textMuted mt-1">{t(desc)}</span>
                  </span>
                  <ChevronRight size={20} className="fx-arrow self-center shrink-0 text-noor-goldBright rtl:rotate-180" aria-hidden="true" />
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </Section>

        <CallToAction />
      </section>
    </div>
  );
}
