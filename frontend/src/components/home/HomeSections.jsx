import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { animate, motion, useInView } from "framer-motion";
import { BookOpen, ScrollText, Languages, Palette, Mic, Compass, Play, MousePointerClick, Headphones, TrendingUp } from "lucide-react";
import { useI18n } from "../../context/I18nContext";
import useLiteMode from "../../hooks/useLiteMode";

const EASE = [0.2, 0.7, 0.2, 1];

// ---------------------------------------------------------------- numbers that count up
function Counter({ to }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });
  const { lite } = useLiteMode();
  const { locale } = useI18n();
  const [n, setN] = useState(lite ? to : 0);

  useEffect(() => {
    if (!inView) return undefined;
    if (lite) { setN(to); return undefined; }
    const run = animate(0, to, { duration: 1.7, ease: "easeOut", onUpdate: (v) => setN(Math.round(v)) });
    return () => run.stop();
  }, [inView, lite, to]);

  return <span ref={ref}>{n.toLocaleString(locale)}</span>;
}

const STATS = [
  { value: 114, label: "home.stats.surahs", Icon: BookOpen },
  { value: 6236, label: "home.stats.ayahs", Icon: ScrollText },
  { value: 3, label: "home.stats.languages", Icon: Languages },
  { value: 9, label: "home.stats.themes", Icon: Palette },
];

export function StatsBand() {
  const { t } = useI18n();
  return (
    <motion.div
      data-no-reveal
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "0px 0px -8% 0px" }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1 } } }}
      className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4"
    >
      {STATS.map(({ value, label, Icon }) => (
        <motion.div
          key={label}
          variants={{ hidden: { opacity: 0, y: 30, scale: 0.95 }, show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.6, ease: EASE } } }}
          className="glass-card fx-card p-5 sm:p-6 text-center"
        >
          <span className="fx-icon mx-auto grid place-items-center h-11 w-11 rounded-2xl bg-noor-gold/15 ring-1 ring-noor-gold/30">
            <Icon size={22} className="text-noor-goldBright" aria-hidden="true" />
          </span>
          <p className="gold-text no-halo font-display text-4xl sm:text-5xl mt-3 leading-none"><Counter to={value} /></p>
          <p className="text-sm text-noor-textMuted mt-2">{t(label)}</p>
        </motion.div>
      ))}
    </motion.div>
  );
}

// ---------------------------------------------------------------- little animated pictures
const BARS = Array.from({ length: 28 }, (_, i) => i);

function Wave({ className = "h-6" }) {
  return (
    <div className={`flex items-center gap-[3px] ${className}`} aria-hidden="true">
      {BARS.map((i) => <i key={i} className="wave-bar" style={{ "--i": i % 12 }} />)}
    </div>
  );
}

function QuranDemo() {
  return (
    <div className="glass-card fx-card p-6 sm:p-8" aria-hidden="true">
      <div className="flex items-center justify-between text-xs text-noor-textMuted mb-4">
        <span lang="ar" className="font-arabic text-base text-noor-goldBright">سورة الفاتحة</span>
        <span>1 : 2</span>
      </div>
      <p dir="rtl" lang="ar" className="font-arabic text-3xl sm:text-4xl leading-[2.1] text-center mb-6">الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ</p>
      <div className="flex items-center gap-3">
        <span className="fx-icon grid place-items-center h-11 w-11 shrink-0 rounded-full bg-noor-gold text-noor-onAccent shadow-glow">
          <Play size={18} fill="currentColor" className="ms-0.5" />
        </span>
        <div className="flex-1 space-y-2.5">
          <div className="demo-progress h-1.5 rounded-full bg-noor-text/10 overflow-hidden"><i /></div>
          <Wave />
        </div>
      </div>
    </div>
  );
}

function ReciteDemo() {
  return (
    <div className="glass-card fx-card p-6 sm:p-8" aria-hidden="true">
      <div className="flex items-center gap-3 mb-6">
        <span className="relative grid place-items-center h-11 w-11 rounded-full bg-noor-emeraldBright/25 ring-1 ring-noor-emeraldBright/50">
          <span className="absolute inset-0 rounded-full bg-noor-emeraldBright/30 animate-ping" />
          <Mic size={20} className="relative text-noor-text" />
        </span>
        <div className="flex-1"><Wave className="h-8" /></div>
      </div>
      <p dir="rtl" lang="ar" className="font-arabic text-3xl sm:text-4xl leading-[2.2] text-center flex flex-wrap justify-center gap-x-4">
        <span className="demo-word demo-ok">الْحَمْدُ</span>
        <span className="demo-word demo-ok">لِلَّهِ</span>
        <span className="demo-word demo-bad px-1">رَبِّ</span>
        <span className="demo-word demo-wait">الْعَالَمِينَ</span>
      </p>
    </div>
  );
}

const TICKS = Array.from({ length: 36 }, (_, i) => i);
const PRAYERS = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];

function PrayerDemo() {
  const { t } = useI18n();
  return (
    <div className="glass-card fx-card p-6 sm:p-8" aria-hidden="true">
      <svg viewBox="0 0 200 200" className="mx-auto h-48 w-48 sm:h-56 sm:w-56">
        <g className="compass-ring">
          <circle cx="100" cy="100" r="94" fill="none" strokeWidth="1.5" strokeDasharray="3 6" className="stroke-noor-gold/60" />
        </g>
        <circle cx="100" cy="100" r="80" fill="none" strokeWidth="1.5" className="stroke-noor-gold/40" />
        {TICKS.map((i) => (
          <line key={i} x1="100" y1="20" x2="100" y2={i % 9 === 0 ? 34 : 27} strokeWidth={i % 9 === 0 ? 2 : 1} className="stroke-noor-textMuted" transform={`rotate(${i * 10} 100 100)`} />
        ))}
        <g className="fill-noor-textMuted" style={{ fontSize: 11 }} textAnchor="middle">
          <text x="100" y="52">N</text>
          <text x="156" y="104">E</text>
          <text x="100" y="156">S</text>
          <text x="44" y="104">W</text>
        </g>
        <g className="compass-needle">
          <polygon points="100,38 109,100 100,108 91,100" className="fill-noor-goldBright" />
          <polygon points="100,162 109,100 100,92 91,100" className="fill-noor-textMuted/60" />
          <circle cx="100" cy="100" r="6" className="fill-noor-bg stroke-noor-gold" strokeWidth="2" />
        </g>
      </svg>
      <div className="flex flex-wrap justify-center gap-2 mt-4">
        {PRAYERS.map((name) => (
          <span key={name} className={`px-3 py-1 rounded-full text-xs border ${name === "Maghrib" ? "border-noor-gold bg-noor-gold/15 text-noor-goldBright" : "border-noor-border text-noor-textMuted"}`}>
            {name === "Maghrib" && <span className="inline-block h-1.5 w-1.5 rounded-full bg-noor-goldBright me-1.5 align-middle animate-pulse" />}
            {t(`prayerName.${name}`)}{name === "Maghrib" ? ` · ${t("home.spot.next")}` : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- feature sections (text one side, picture the other)
function Spotlight({ flip = false, Icon, tag, title, body, to, cta, children }) {
  const { t, isRTL } = useI18n();
  const dir = (flip ? 1 : -1) * (isRTL ? -1 : 1);
  return (
    <div className="grid lg:grid-cols-2 gap-6 lg:gap-14 items-center" data-no-reveal>
      <motion.div
        initial={{ opacity: 0, x: 60 * dir }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, margin: "0px 0px -12% 0px" }}
        transition={{ duration: 0.8, ease: EASE }}
        className={flip ? "lg:order-2" : ""}
      >
        <div className="glass-card p-6 sm:p-8">
          <span className="inline-flex items-center gap-2 rounded-full border border-noor-gold/40 bg-noor-gold/10 px-3 py-1 text-xs text-noor-goldBright">
            <Icon size={14} aria-hidden="true" /> {t(tag)}
          </span>
          <h3 className="font-display text-3xl sm:text-4xl leading-tight mt-4">{t(title)}</h3>
          <p className="text-noor-textMuted leading-relaxed mt-3">{t(body)}</p>
          <Link to={to} className="inline-flex items-center mt-6 px-6 py-2.5 rounded-full bg-noor-gold text-noor-onAccent font-medium shadow-glow hover:bg-noor-goldBright hover:-translate-y-0.5 active:translate-y-0.5 transition-all">
            {t(cta)}
          </Link>
        </div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, x: -60 * dir, scale: 0.94 }}
        whileInView={{ opacity: 1, x: 0, scale: 1 }}
        viewport={{ once: true, margin: "0px 0px -12% 0px" }}
        transition={{ duration: 0.8, delay: 0.12, ease: EASE }}
      >
        {children}
      </motion.div>
    </div>
  );
}

export function FeatureSpotlights({ quranHref }) {
  return (
    <div className="space-y-12 sm:space-y-20">
      <Spotlight Icon={BookOpen} tag="nav.quran" title="home.spot.quran.title" body="home.spot.quran.body" to={quranHref} cta="home.openQuran">
        <QuranDemo />
      </Spotlight>
      <Spotlight flip Icon={Mic} tag="nav.recite" title="home.spot.recite.title" body="home.spot.recite.body" to="/recitation/live" cta="home.spot.recite.cta">
        <ReciteDemo />
      </Spotlight>
      <Spotlight Icon={Compass} tag="nav.prayer" title="home.spot.prayer.title" body="home.spot.prayer.body" to="/prayer" cta="home.spot.prayer.cta">
        <PrayerDemo />
      </Spotlight>
    </div>
  );
}

// ---------------------------------------------------------------- three steps
const STEPS = [
  { n: 1, Icon: MousePointerClick, title: "home.how.s1.title", body: "home.how.s1.body" },
  { n: 2, Icon: Headphones, title: "home.how.s2.title", body: "home.how.s2.body" },
  { n: 3, Icon: TrendingUp, title: "home.how.s3.title", body: "home.how.s3.body" },
];

export function HowItWorks() {
  const { t } = useI18n();
  return (
    <div className="relative" data-no-reveal>
      <motion.span
        aria-hidden="true"
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true, margin: "0px 0px -10% 0px" }}
        transition={{ duration: 1.3, ease: EASE }}
        className="hidden md:block absolute top-[3.6rem] start-[17%] end-[17%] h-px origin-left rtl:origin-right bg-gradient-to-r from-transparent via-noor-gold to-transparent"
      />
      <motion.div
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "0px 0px -8% 0px" }}
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.18 } } }}
        className="relative grid md:grid-cols-3 gap-4 sm:gap-5"
      >
        {STEPS.map(({ n, Icon, title, body }) => (
          <motion.div
            key={n}
            variants={{ hidden: { opacity: 0, y: 40 }, show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } } }}
            className="glass-card fx-card p-6 sm:p-7 text-center"
          >
            <span className="fx-icon relative mx-auto grid place-items-center h-14 w-14 rounded-2xl bg-noor-gold/15 ring-1 ring-noor-gold/40">
              <Icon size={26} className="text-noor-goldBright" aria-hidden="true" />
              <span className="absolute -top-2 -end-2 grid place-items-center h-6 w-6 rounded-full bg-noor-gold text-noor-onAccent text-xs font-bold">{n}</span>
            </span>
            <h3 className="font-display text-xl mt-4">{t(title)}</h3>
            <p className="text-sm text-noor-textMuted mt-2 leading-relaxed">{t(body)}</p>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
