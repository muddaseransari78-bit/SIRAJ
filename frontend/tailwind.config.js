/** @type {import('tailwindcss').Config} */
// Colours are CSS variables now (Phase 29 - themes). The real values live in src/theme/themes.js
// and are written to src/theme/themes.css, one block per theme. The class names (bg-noor-bg, text-noor-gold ...) did not change.
const v = (name) => `rgb(var(--noor-${name}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        noor: {
          bg: v("bg"),
          surface: v("surface"),
          surface2: v("surface2"),
          emerald: v("emerald"),
          emeraldBright: v("emeraldBright"),
          gold: v("gold"), // theme accent
          goldBright: v("goldBright"), // theme accent as text
          text: v("text"),
          textMuted: v("textMuted"),
          border: v("border"),
          onAccent: v("onAccent"), // text on top of bg-noor-gold buttons
          danger: v("danger"),
          success: v("success"),
          warn: v("warn"),
        },
      },
      fontFamily: {
        display: ["Amiri", "serif"],
        body: ["Inter", "system-ui", "sans-serif"],
        arabic: ["Noto Naskh Arabic", "serif"],
        urdu: ["Noto Nastaliq Urdu", "serif"],
      },
      boxShadow: {
        glow: "0 0 40px rgb(var(--noor-goldBright) / 0.15)",
        emeraldGlow: "0 0 40px rgb(var(--noor-emeraldBright) / 0.2)",
      },
      backgroundImage: {
        "noor-radial": "radial-gradient(circle at 50% 0%, rgb(var(--noor-radial)) 0%, rgb(var(--noor-bg)) 60%)",
      },
    },
  },
  plugins: [],
};
