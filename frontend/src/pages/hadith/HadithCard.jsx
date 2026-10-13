import React, { useState } from "react";
import { Bookmark, Copy, Check } from "lucide-react";
import { plain } from "../../utils/text";
import { addBookmark } from "../../services/contentService";
import { useAuth } from "../../context/AuthContext";
import { useI18n } from "../../context/I18nContext";

// Grading words (Sahih, Hasan, Daif ...) and graders in Urdu / Arabic, so an Urdu or Arabic page shows no English words.
const GRADE_WORDS = {
  sahih: ["صحیح", "صحيح"], hasan: ["حسن", "حسن"], "hasan sahih": ["حسن صحیح", "حسن صحيح"], "sahih hasan": ["صحیح حسن", "صحيح حسن"],
  daif: ["ضعیف", "ضعيف"], "da'if": ["ضعیف", "ضعيف"], weak: ["ضعیف", "ضعيف"], mawdu: ["موضوع", "موضوع"], "maqbul": ["مقبول", "مقبول"],
  "sahih li ghairihi": ["صحیح لغیرہ", "صحيح لغيره"], "hasan li ghairihi": ["حسن لغیرہ", "حسن لغيره"], "sahih (darussalam)": ["صحیح (دار السلام)", "صحيح (دار السلام)"],
  darussalam: ["دار السلام", "دار السلام"], "al-albani": ["البانی", "الألباني"], "zubair `ali za'i": ["زبیر علی زئی", "زبير علي زئي"],
  "zubair ali za'i": ["زبیر علی زئی", "زبير علي زئي"], "al-bukhari": ["بخاری", "البخاري"], muslim: ["مسلم", "مسلم"], "ibn hibban": ["ابن حبان", "ابن حبان"],
  "al-hakim": ["حاکم", "الحاكم"], "al-tirmidhi": ["ترمذی", "الترمذي"], "abu dawud": ["ابو داؤد", "أبو داود"], "ibn hajar": ["ابن حجر", "ابن حجر"],
};
export function gradeText(word, lang) {
  if (lang === "en" || !word) return word;
  const hit = GRADE_WORDS[String(word).trim().toLowerCase()];
  return hit ? hit[lang === "ar" ? 1 : 0] : word;
}

// One Hadith with Arabic, English, and full source reference (never removed).
export default function HadithCard({ hadith }) {
  const { t, lang } = useI18n();
  const [showUr, setShowUr] = useState(false);
  const { user } = useAuth();
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const ar = plain(hadith.ar);
  const en = plain(hadith.en);
  const grades = hadith.en?.grades || [];
  const ur = plain(hadith.ur || hadith.urdu);
  const urVisible = lang === "ur" || showUr;
  // one language per card: collection and grading words follow the page language (Urdu page = Urdu, Arabic page = Arabic)
  const colKey = `hadith.col.${String(hadith.collection || "").toLowerCase()}`;
  const colName = lang !== "en" && t(colKey) !== colKey ? t(colKey) : hadith.collection;
  const reference = t("hadith.refFormat", { collection: colName, book: hadith.bookNumber, number: hadith.hadithNumber });
  const gradeWord = (g) => gradeText(g, lang);

  async function save() {
    if (!user) return alert(t("hadith.loginBookmark"));
    try {
      await addBookmark({ type: "HADITH", hadithBook: hadith.collection, hadithNumber: String(hadith.hadithNumber) });
      setSaved(true);
    } catch (e) { alert(t("hadith.saveFail")); }
  }
  async function copy() {
    await navigator.clipboard.writeText(`${ar}\n\n${lang === "ur" ? (ur || en) : [lang === "en" ? en : "", showUr ? ur : ""].filter(Boolean).join("\n\n")}\n\n${reference}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="glass-card p-5 space-y-3">
      {/* chapter title: English for English readers, Arabic for Urdu / Arabic readers (there is no Urdu title in the source) */}
      {lang === "en" && hadith.chapterTitle?.en && <p className="text-xs text-noor-goldBright">{hadith.chapterTitle.en}</p>}
      {lang !== "en" && (hadith.chapterTitle?.ar || hadith.chapterTitle?.en) && (
        <p dir={hadith.chapterTitle?.ar ? "rtl" : "ltr"} lang={hadith.chapterTitle?.ar ? "ar" : "en"} className={`text-xs text-noor-goldBright ${hadith.chapterTitle?.ar ? "font-arabic text-sm" : ""}`}>{hadith.chapterTitle?.ar || hadith.chapterTitle.en}</p>
      )}
      {ar && <p dir="rtl" className="font-arabic text-xl text-right leading-loose">{ar}</p>}
      {lang === "en" && en && <p className="text-noor-textMuted">{en}</p>}
      {urVisible && ur && <p dir="rtl" lang="ur" className="font-urdu text-noor-textMuted text-right text-lg leading-loose">{ur}</p>}
      {lang !== "ur" && showUr && !ur && <p className="text-xs text-noor-textMuted">{t("common.urduNone")}</p>}
      {lang !== "en" && !ur && lang === "ur" && <p className="text-xs text-noor-textMuted">{t("hadith.urduMissing")}</p>}
      {grades.length > 0 && (
        <p className="text-xs text-noor-emeraldBright">
          {t("hadith.grading")}: {grades.map((g) => `${gradeWord(g.grade)}${g.graded_by ? ` (${gradeWord(g.graded_by)})` : ""}`).join("; ")}
        </p>
      )}
      <div className="flex items-center justify-between pt-2 border-t border-noor-border">
        <p className="text-xs text-noor-textMuted capitalize">{t("hadith.reference")}: {reference}</p>
        <div className="flex gap-3">
          {lang !== "ur" && (
            <button onClick={() => setShowUr((v) => !v)} aria-pressed={showUr} className={`text-xs flex items-center gap-1 hover:text-noor-goldBright ${showUr ? "text-noor-goldBright" : "text-noor-textMuted"}`}>
              {showUr ? t("common.urduHide") : t("common.urduBtn")}
            </button>
          )}
          <button onClick={save} className="text-xs flex items-center gap-1 text-noor-textMuted hover:text-noor-goldBright">
            <Bookmark size={14} /> {saved ? t("common.saved") : t("common.bookmark")}
          </button>
          <button onClick={copy} className="text-xs flex items-center gap-1 text-noor-textMuted hover:text-noor-goldBright">
            {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? t("common.copied") : t("common.copy")}
          </button>
        </div>
      </div>
    </div>
  );
}
