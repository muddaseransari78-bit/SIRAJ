import React from "react";
import { Link } from "react-router-dom";
import { ARABIC_FONTS } from "../hooks/useReadingSettings";
import { parseTajweed } from "../utils/tajweed";
import { BISMILLAH, groupBySurah, hasBismillahLine, splitBismillah, toArabicDigits } from "../utils/mushaf";
import { useI18n } from "../context/I18nContext";

/**
 * Continuous Mushaf-style Arabic text: Ayahs flow one after another and each ends with ﴿n﴾.
 * Used for a whole Surah AND for Juz / Page / Hizb / Ruku. Surah names appear as headings.
 * Pure text layout (not the printed Mushaf images).
 * Props:
 *  ayahs, settings, tajweedMap (optional)
 *  playingKey   - "surah:ayah" of the Ayah being recited (it is highlighted)
 *  selectedKey  - "surah:ayah" the reader tapped (it is highlighted differently)
 *  onAyahClick(ayah) - tap / Enter on an Ayah (the pages play it and show its actions)
 */
export default function MushafText({ ayahs, settings, tajweedMap = {}, playingKey = null, selectedKey = null, onAyahClick }) {
  const { t } = useI18n();
  const font = ARABIC_FONTS.find((f) => f.id === settings.arabicFont) || ARABIC_FONTS[0];
  const groups = groupBySurah(ayahs);

  return (
    <div className="space-y-8">
      {groups.map((g) => {
        const startsSurah = g.items[0].numberInSurah === 1;
        return (
          <section key={`${g.surahNumber}-${g.items[0].numberInSurah}`} aria-label={g.english}>
            {startsSurah && (
              <div className="text-center mb-3">
                <Link to={`/quran/${g.surahNumber}`} className="font-arabic text-2xl text-noor-goldBright">{g.surahName}</Link>
                <p className="text-xs text-noor-textMuted">{g.english}</p>
                {hasBismillahLine(g.surahNumber) && (
                  <p dir="rtl" lang="ar" className="font-arabic text-noor-text mt-3" style={{ fontSize: `${settings.fontSize}px`, fontFamily: font.css }}>
                    {BISMILLAH}
                  </p>
                )}
              </div>
            )}
            <p dir="rtl" lang="ar" className="mushaf-text font-arabic" style={{ fontSize: `${settings.fontSize}px`, fontFamily: font.css }}>
              {g.items.map((a) => {
                const key = `${a.surahNumber}:${a.numberInSurah}`;
                const marked = settings.showTajweed ? tajweedMap[key] : null;
                // The Bismillah is shown as its own line above, so it is removed from the first Ayah's text
                const plainText = !marked && a.numberInSurah === 1 && hasBismillahLine(a.surahNumber) ? splitBismillah(a.arabicText).rest : a.arabicText;
                const cls = `mushaf-ayah${playingKey === key ? " ayah-active" : ""}${selectedKey === key ? " mushaf-ayah-selected" : ""}`;
                const label = t("mushaf.ayahLabel", { s: a.surahNumber, n: a.numberInSurah });
                return (
                  <React.Fragment key={a.globalAyahNumber ?? key}>
                    <span
                      id={`ayah-${a.surahNumber}-${a.numberInSurah}`}
                      className={cls}
                      {...(onAyahClick
                        ? {
                            role: "button", tabIndex: 0, "aria-label": label,
                            "aria-pressed": selectedKey === key,
                            onClick: () => onAyahClick(a),
                            onKeyDown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onAyahClick(a); } },
                          }
                        : {})}
                    >
                      {marked
                        ? parseTajweed(marked).map((p, i) => (p.rule ? <span key={i} className={p.rule.cls} title={p.rule.name}>{p.text}</span> : <React.Fragment key={i}>{p.text}</React.Fragment>))
                        : plainText}
                      {" "}
                      <span className="ayah-end">﴿{toArabicDigits(a.numberInSurah)}﴾</span>
                    </span>{" "}
                  </React.Fragment>
                );
              })}
            </p>
          </section>
        );
      })}
    </div>
  );
}
