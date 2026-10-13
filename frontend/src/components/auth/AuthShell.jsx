import React from "react";
import { motion } from "framer-motion";
import { Bookmark, TrendingUp, Target, Sparkles } from "lucide-react";
import { useI18n } from "../../context/I18nContext";
import { logoFile } from "../../theme/themeMedia";
import { useTheme } from "../../context/ThemeContext";

const PERKS = [
  { Icon: Bookmark, key: "auth.perk1" },
  { Icon: TrendingUp, key: "auth.perk2" },
  { Icon: Target, key: "auth.perk3" },
  { Icon: Sparkles, key: "auth.perk4" },
];

// Shared frame for Login and Register: a picture side with the logo and benefits (large screens),
// and a glass card with a slowly turning gold edge for the form.
export default function AuthShell({ title, subtitle, children, footer }) {
  const { t } = useI18n();
  const { themeId } = useTheme();
  const logoBig = logoFile(themeId);
  const ease = [0.2, 0.7, 0.2, 1];
  return (
    <div className="relative max-w-6xl mx-auto px-4 py-8 sm:py-14 grid lg:grid-cols-[1.05fr_1fr] gap-10 lg:gap-16 items-center min-h-[calc(100svh-8rem)]">
      <aside className="hidden lg:block relative" aria-hidden="true">
        <span className="auth-orb -top-10 -start-10 h-72 w-72 bg-noor-gold/50" />
        <span className="auth-orb bottom-0 end-0 h-64 w-64 bg-noor-emeraldBright/40" style={{ animationDelay: "-6s" }} />
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease }} className="relative">
          <img src={logoBig} alt="" width="768" height="768" decoding="async" className="hero-logo h-44 w-44 object-contain" />
          <p className="gold-text no-halo font-display text-6xl tracking-[0.18em] mt-4" dir="ltr">SIRAJ</p>
          <p className="text-noor-text/90 text-xl mt-3 max-w-md">{t("brand.tagline")}</p>
          <ul className="mt-8 space-y-3">
            {PERKS.map(({ Icon, key }, i) => (
              <motion.li
                key={key}
                initial={{ opacity: 0, x: -24 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.12, duration: 0.6, ease }}
                className="flex items-center gap-3 text-noor-text/90"
              >
                <span className="grid place-items-center h-9 w-9 rounded-xl bg-noor-gold/15 ring-1 ring-noor-gold/30">
                  <Icon size={18} className="text-noor-goldBright" />
                </span>
                {t(key)}
              </motion.li>
            ))}
          </ul>
        </motion.div>
      </aside>

      <motion.div initial={{ opacity: 0, y: 36, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.8, ease }} className="relative w-full max-w-md mx-auto lg:max-w-none">
        <div className="auth-card glass-card p-6 sm:p-9" data-no-reveal>
          <img src={logoBig} alt="" width="96" height="96" decoding="async" className="hero-logo lg:hidden mx-auto h-20 w-20 object-contain mb-2" />
          <h1 className="text-3xl font-display text-noor-goldBright text-center">{title}</h1>
          <p className="text-sm text-noor-textMuted text-center mt-1 mb-6">{subtitle}</p>
          {children}
        </div>
        {footer}
      </motion.div>
    </div>
  );
}
