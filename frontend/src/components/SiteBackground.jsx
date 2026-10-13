import React, { useEffect, useState } from "react";
import { AnimatePresence, motion, useScroll, useTransform } from "framer-motion";
import { useTheme } from "../context/ThemeContext";
import useLiteMode from "../hooks/useLiteMode";
import { bgFile } from "../theme/themeMedia";

// The picture behind every page. It follows the active theme (9 themes = 9 pictures), cross-fades when the
// theme changes, drifts slowly while you scroll (parallax) and gets a little darker further down the page so
// text stays easy to read. A coloured scrim (made from the theme's own background colour) keeps contrast good
// on every theme. <html data-bg="on"> tells the stylesheet that glass panels may be used (see index.css).
function Picture({ themeId, small, style, onReady }) {
  return (
    <motion.div
      className="site-bg-pic"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.9, ease: "easeInOut" }}
      style={style}
    >
      <picture>
        <source media="(max-width: 767px)" srcSet={bgFile(themeId, true)} type="image/webp" />
        <img
          src={bgFile(themeId, small)}
          alt=""
          decoding="async"
          draggable="false"
          onLoad={onReady}
          onError={onReady}
        />
      </picture>
    </motion.div>
  );
}

function Animated({ themeId }) {
  const { scrollY } = useScroll();
  // the picture moves up to 46px while you scroll through the first ~3000px, then stays
  const y = useTransform(scrollY, (v) => `${(-Math.min(Math.max(v, 0), 3000) / 3000) * 46}px`);
  const scale = useTransform(scrollY, (v) => 1.04 + (Math.min(Math.max(v, 0), 3000) / 3000) * 0.08);
  const deeper = useTransform(scrollY, [0, 900, 2600], [0, 0.18, 0.32]);
  return (
    <>
      <AnimatePresence initial={false}>
        <Picture key={themeId} themeId={themeId} small={false} style={{ y, scale }} />
      </AnimatePresence>
      <motion.div className="site-bg-deeper" style={{ opacity: deeper }} />
    </>
  );
}

function Still({ themeId }) {
  // Lite mode / reduced motion: one small picture, no movement, no cross-fade
  return (
    <div className="site-bg-pic" style={{ opacity: 1 }}>
      <picture>
        <img src={bgFile(themeId, true)} alt="" decoding="async" draggable="false" />
      </picture>
    </div>
  );
}

export default function SiteBackground() {
  const { themeId } = useTheme();
  const { lite } = useLiteMode();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.bg = "on";
    setMounted(true);
    return () => { delete root.dataset.bg; };
  }, []);

  return (
    <div className="site-bg" aria-hidden="true">
      {mounted && (lite ? <Still themeId={themeId} /> : <Animated themeId={themeId} />)}
      <div className="site-bg-scrim" />
      <div className="site-bg-glow" />
      {!lite && (
        <>
          <span className="site-orb site-orb-a" />
          <span className="site-orb site-orb-b" />
        </>
      )}
      <div className="site-bg-pattern geo-pattern" />
    </div>
  );
}
