import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Bookmark, Copy, Check } from "lucide-react";
import { fetchDuas, addBookmark } from "../../services/contentService";
import { SkeletonCard, ErrorState } from "../../components/Skeleton";
import { plain } from "../../utils/text";
import { useAuth } from "../../context/AuthContext";
import { useI18n } from "../../context/I18nContext";

function DuaCard({ dua }) {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const [showUr, setShowUr] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const ar = plain(dua.ar);
  const en = plain(dua.en);
  const translit = dua.transliteration?.en;
  const source = dua.source?.en;
  const ur = plain(dua.ur);
  const urMachine = Boolean(dua.ur?.machine); // made by the translation service, not typed by a person
  const urVisible = lang === "ur" || showUr;

  const save = async () => {
    if (!user) return alert(t("duas.loginSave"));
    try { await addBookmark({ type: "DUA", duaRef: String(dua.slug || dua.number) }); setSaved(true); }
    catch (e) { alert(t("duas.saveFail")); }
  };
  const copy = async () => {
    await navigator.clipboard.writeText(`${ar}\n\n${translit || ""}\n\n${lang === "ur" ? (ur || en) : [lang === "en" ? en : "", showUr ? ur : ""].filter(Boolean).join("\n\n")}\n\n${source || ""}`);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="glass-card p-5 space-y-3">
      {ar && <p dir="rtl" className="font-arabic text-2xl text-right leading-loose">{ar}</p>}
      {translit && <p className="italic text-noor-goldBright text-sm">{translit}</p>}
      {lang === "en" && en && <p className="text-noor-textMuted">{en}</p>}
      {urVisible && ur && <p dir="rtl" lang="ur" className="font-urdu text-noor-textMuted text-right text-lg leading-loose">{ur}</p>}
      {urVisible && ur && urMachine && <p className="text-xs text-amber-400">{t("duas.urduMachine")}</p>}
      {lang !== "ur" && showUr && !ur && <p className="text-xs text-noor-textMuted">{t("common.urduNone")}</p>}
      {lang === "ur" && !ur && en && (
        <>
          <p className="text-noor-textMuted" dir="ltr" lang="en">{en}</p>
          <p className="text-xs text-noor-textMuted">{t("duas.urduMissing")}</p>
        </>
      )}
      {dua.repeatCount > 1 && <p className="text-xs text-noor-emeraldBright">{t("duas.repeat", { n: dua.repeatCount })}</p>}
      <div className="flex justify-between items-center pt-2 border-t border-noor-border">
        <p className="text-xs text-noor-textMuted">{t("duas.source")}: {source || "Hisn al-Muslim"}{dua.custom ? ` · ${t("duas.addedBy")}` : ""}</p>
        <div className="flex gap-3">
          {lang !== "ur" && (
            <button onClick={() => setShowUr((v) => !v)} aria-pressed={showUr} className={`text-xs flex items-center gap-1 hover:text-noor-goldBright ${showUr ? "text-noor-goldBright" : "text-noor-textMuted"}`}>
              {showUr ? t("common.urduHide") : t("common.urduBtn")}
            </button>
          )}
          <button onClick={save} className="text-xs flex items-center gap-1 hover:text-noor-goldBright text-noor-textMuted"><Bookmark size={14} />{saved ? t("common.saved") : t("common.save")}</button>
          <button onClick={copy} className="text-xs flex items-center gap-1 hover:text-noor-goldBright text-noor-textMuted">{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? t("common.copied") : t("common.copy")}</button>
        </div>
      </div>
    </div>
  );
}

export default function DuaList() {
  const { t, isRTL } = useI18n();
  const { category } = useParams();
  const catKey = `duas.cat.${category}`;
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const load = () => { setError(false); setData(null); fetchDuas(category).then(setData).catch(() => setError(true)); };
  useEffect(load, [category]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <Link to="/duas" className="text-sm text-noor-textMuted hover:text-noor-goldBright">{isRTL ? "→" : "←"} {t("duas.allCategories")}</Link>
      <h1 className="text-2xl font-display text-noor-goldBright my-3 capitalize">{t(catKey) !== catKey ? t(catKey) : (data?.label || category.replace("-", " "))}</h1>
      {error && <ErrorState message={t("duas.loadError")} onRetry={load} />}
      {!data && !error && <div className="space-y-4">{[1,2].map((i) => <SkeletonCard key={i} />)}</div>}
      {data && (
        <div className="space-y-4">
          {data.duas?.map((d, i) => <DuaCard key={d.slug || d.number || i} dua={d} />)}
          {data.customDuas?.map((d) => <DuaCard key={d.slug} dua={d} />)}
          {(!data.duas || data.duas.length === 0) && <p className="text-noor-textMuted">{t("duas.none")}</p>}
        </div>
      )}
    </div>
  );
}
