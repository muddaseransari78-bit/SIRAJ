import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { globalSearch } from "../../services/contentService";
import { SkeletonCard, ErrorState } from "../../components/Skeleton";
import HadithCard from "../hadith/HadithCard";
import { splitHighlight, stripTags } from "../../utils/searchHighlight";
import { loadRecent, rememberSearch, clearRecent } from "../../utils/recentSearches";
import AyahSnippet from "../../components/AyahSnippet";
import { resultSurahName } from "../../utils/ayahLayers";
import { useI18n } from "../../context/I18nContext";

// Filter chips. "all" asks for everything; the others ask the server for ONE kind with a bigger limit.
const FILTERS = [
  ["all", "sf.all"], ["surahs", "sf.surahs"], ["quran", "sf.quran"], ["hadith", "sf.hadith"], ["books", "sf.books"],
  ["tafseer", "sf.tafseer"], ["duas", "sf.duas"], ["topics", "sf.topics"], ["pages", "sf.pages"],
];
const KIND_KEY = { translation: "sk.translation", transliteration: "sk.transliteration", arabic: "sk.arabic", urdu: "sk.urdu" };
const ALL_LIMIT = 15;
const FOCUS_LIMIT = 50;

// Text with the searched words marked (the text itself is never altered)
function Marked({ text, query }) {
  return (
    <>
      {splitHighlight(stripTags(text), query).map((p, i) =>
        p.hit ? <mark key={i} className="bg-noor-gold/25 text-noor-goldBright rounded px-0.5">{p.text}</mark> : <span key={i}>{p.text}</span>
      )}
    </>
  );
}

function Section({ id, title, count, children, empty, failed, onRetry }) {
  const { t } = useI18n();
  return (
    <section aria-labelledby={`sec-${id}`}>
      <h2 id={`sec-${id}`} className="text-xl mb-3">
        {title} {count !== null && <span className="text-sm text-noor-textMuted">({count})</span>}
      </h2>
      {failed && (
        <p role="alert" className="text-sm text-red-400 mb-2">
          {t("search.unavailable")} <button onClick={onRetry} className="underline">{t("search.tryAgain")}</button>
        </p>
      )}
      {children}
      {!failed && empty && <p className="text-noor-textMuted text-sm">{empty}</p>}
    </section>
  );
}

const cardCls = "block glass-card p-4 hover:shadow-emeraldGlow transition-shadow";

export default function Search() {
  const { t, lang, isRTL } = useI18n();
  const [params, setParams] = useSearchParams();
  const q = (params.get("q") || "").trim();
  const typeParam = params.get("type") || "all";
  const type = FILTERS.some(([k]) => k === typeParam) ? typeParam : "all";
  const navigate = useNavigate();
  const [input, setInput] = useState(q);
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [recent, setRecent] = useState(() => loadRecent());

  useEffect(() => { setInput(q); }, [q]);

  useEffect(() => {
    if (q.length < 2) { setData(null); return undefined; }
    const ctrl = new AbortController();
    setError(false); setData(null);
    globalSearch(q, { types: type === "all" ? undefined : type, limit: type === "all" ? ALL_LIMIT : FOCUS_LIMIT, signal: ctrl.signal, lang })
      .then((d) => { setData(d); setRecent(rememberSearch(q)); })
      .catch((e) => { if (e?.code !== "ERR_CANCELED") setError(true); });
    return () => ctrl.abort();
  }, [q, type, attempt, lang]);

  const retry = () => setAttempt((n) => n + 1);
  const setType = (next) => setParams(next === "all" ? { q } : { q, type: next });
  const submit = (e) => {
    e.preventDefault();
    if (input.trim().length >= 2) navigate(`/search?q=${encodeURIComponent(input.trim())}${type !== "all" ? `&type=${type}` : ""}`);
  };

  const show = (name) => type === "all" || type === name;
  const totalFound = data ? Object.values(data.totals).reduce((a, b) => a + b, 0) : 0;
  const nothing = data && totalFound === 0 && !Object.values(data.errors).some(Boolean);

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-display text-noor-goldBright mb-4">{t("nav.search")}</h1>
      <form onSubmit={submit} role="search" className="flex gap-2 mb-4">
        <input autoFocus value={input} onChange={(e) => setInput(e.target.value)} dir="auto" maxLength={100}
          placeholder={t("search.pagePh")}
          className="flex-1 rounded-lg bg-noor-surface2 border border-noor-border px-4 py-3" aria-label={t("search.submit")} />
        <button className="px-5 rounded-lg bg-noor-gold text-noor-onAccent font-medium">{t("search.submit")}</button>
      </form>

      {q.length >= 2 && (
        <div role="group" aria-label={t("search.filterAria")} className="flex flex-wrap gap-2 mb-6">
          {FILTERS.map(([key, labelKey]) => {
            const n = data && key !== "all" ? data.totals[key] : null;
            return (
              <button key={key} aria-pressed={type === key} onClick={() => setType(key)}
                className={`px-3 py-1.5 rounded-full text-sm border ${type === key ? "bg-noor-gold text-noor-onAccent border-noor-gold" : "bg-noor-surface2 border-noor-border"}`}>
                {t(labelKey)}{n ? <span className="opacity-70"> {n}</span> : null}
              </button>
            );
          })}
        </div>
      )}

      <p role="note" className="text-xs text-noor-textMuted mb-8">
        {t("search.note")}
      </p>

      {q.length < 2 && (
        <div className="space-y-6">
          <p className="text-noor-textMuted">{t("search.minChars")}</p>
          {recent.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm text-noor-textMuted">{t("search.recent")}</h2>
                <button onClick={() => setRecent(clearRecent())} className="text-xs text-noor-textMuted hover:text-noor-goldBright">{t("search.clearRecent")}</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {recent.map((r) => <Link key={r} to={`/search?q=${encodeURIComponent(r)}`} className="px-3 py-1.5 rounded-full text-sm bg-noor-surface2 border border-noor-border">{r}</Link>)}
              </div>
            </div>
          )}
        </div>
      )}

      {error && <ErrorState message={t("search.failed")} onRetry={retry} />}
      {q.length >= 2 && !data && !error && <div role="status" aria-label={t("search.searching")}><SkeletonCard /></div>}

      {data && (
        <div className="space-y-10">
          <p className="sr-only" role="status" aria-live="polite">{t("search.resultsFor", { n: totalFound, q })}</p>

          {data.reference && (
            <div className="space-y-2">
              <Link to={`/quran/${data.reference.surahNumber}?ayah=${data.reference.ayahNumber}`} className={`${cardCls} border-noor-gold`}>
                {t("search.goQuran", { ref: `${data.reference.surahNumber}:${data.reference.ayahNumber}${data.reference.endAyah ? `–${data.reference.endAyah}` : ""}` })} {isRTL ? "←" : "→"}
              </Link>
              <Link to={`/tafseer/${data.reference.surahNumber}/${data.reference.ayahNumber}`} className={cardCls}>
                {t("search.readTafseer", { ref: `${data.reference.surahNumber}:${data.reference.ayahNumber}` })} {isRTL ? "←" : "→"}
              </Link>
            </div>
          )}

          {data.hadithReference && (
            <p className="glass-card p-4 text-sm">
              {data.hadithReference.found
                ? <>{t("search.hadithShown", { c: data.hadithReference.collectionName, n: data.hadithReference.hadithNumber })}</>
                : <>{t("search.hadithMissing", { c: data.hadithReference.collectionName, n: data.hadithReference.hadithNumber })} <Link to={`/hadith/${data.hadithReference.collection}`} className="text-noor-goldBright underline">{t("search.browseBook", { c: data.hadithReference.collectionName })}</Link> {t("search.browseTail")}</>}
            </p>
          )}

          {nothing && (
            <div className="glass-card p-6 space-y-3">
              <p>{t("search.none", { q })}</p>
              <ul className="text-sm text-noor-textMuted list-disc ps-5 space-y-1">
                <li>{t("search.tip1")}</li>
                <li>{t("search.tip2")}</li>
                <li>{t("search.tip3")} <Link to="/topics" className="text-noor-goldBright underline">{t("search.topicsLink")}</Link> · <Link to="/assistant" className="text-noor-goldBright underline">{t("search.finderLink")}</Link></li>
              </ul>
            </div>
          )}

          {show("surahs") && data.surahs.length > 0 && (
            <Section id="surahs" title={t("sf.surahs")} count={data.surahs.length} failed={data.errors.surahs} onRetry={retry}>
              <div className="grid sm:grid-cols-2 gap-2">
                {data.surahs.map((s) => (
                  <Link key={s.number} to={s.to} className={cardCls}>
                    <div className="flex items-center justify-between gap-3">
                      <span><span className="text-xs text-noor-goldBright">{t("common.surahN", { n: s.number })}</span><span className="block">{lang === "en" ? s.englishName : s.name}</span></span>
                      <span lang="ar" dir="rtl" className="font-arabic text-noor-goldBright text-lg">{s.name}</span>
                    </div>
                    <p className="text-xs text-noor-textMuted mt-1">{lang === "en" ? `${s.englishNameTranslation} · ` : ""}{t(`rev.${s.revelationType}`) !== `rev.${s.revelationType}` ? t(`rev.${s.revelationType}`) : s.revelationType} · {t("common.ayahsN", { n: s.numberOfAyahs })}</p>
                  </Link>
                ))}
              </div>
            </Section>
          )}

          {show("quran") && (data.quran.length > 0 || data.errors.quran || type === "quran") && (
            <Section id="quran" title={t("sf.quran")} count={data.quranTotal} failed={data.errors.quran} onRetry={retry} empty={data.quran.length === 0 && !data.reference ? t("search.noQuran") : null}>
              <div className="space-y-2">
                {data.quran.map((r) => (
                  <div key={`${r.surahNumber}:${r.ayahNumber}`} className="glass-card p-4 hover:shadow-emeraldGlow transition-shadow">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <Link to={`/quran/${r.surahNumber}?ayah=${r.ayahNumber}`} className="text-xs text-noor-goldBright hover:underline">{resultSurahName(r, lang)} {r.surahNumber}:{r.ayahNumber}</Link>
                      <span className="flex gap-1">{r.matches.map((m) => <span key={m.kind} className="text-[11px] px-2 py-0.5 rounded-full bg-noor-surface2 border border-noor-border text-noor-textMuted">{KIND_KEY[m.kind] ? t(KIND_KEY[m.kind]) : m.kind}</span>)}</span>
                    </div>
                    <AyahSnippet r={r} lang={lang} query={data.query} />
                    <div className="flex gap-4 mt-2 text-xs">
                      <Link to={`/quran/${r.surahNumber}?ayah=${r.ayahNumber}`} className="text-noor-textMuted hover:text-noor-goldBright">{t("search.readInSurah")}</Link>
                      <Link to={`/tafseer/${r.surahNumber}/${r.ayahNumber}`} className="text-noor-textMuted hover:text-noor-goldBright">{t("sf.tafseer")}</Link>
                    </div>
                  </div>
                ))}
              </div>
              {type === "all" && data.quranTotal > data.quran.length && (
                <button onClick={() => setType("quran")} className="mt-3 text-sm text-noor-goldBright underline">{t("search.moreQuran", { n: data.quranTotal })}</button>
              )}
              {type === "quran" && data.quranTotal > data.quran.length && (
                <p className="mt-3 text-xs text-noor-textMuted">{t("search.showingFirst", { n: data.quran.length, total: data.quranTotal })}</p>
              )}
            </Section>
          )}

          {show("hadith") && (data.hadith.length > 0 || data.errors.hadith || type === "hadith") && (
            <Section id="hadith" title={t("sf.hadith")} count={data.hadith.length} failed={data.errors.hadith} onRetry={retry} empty={data.hadith.length === 0 ? t("search.noHadith") : null}>
              <div className="space-y-4">
                {data.hadith.map((h, i) => (
                  <div key={`${h.collection}-${h.bookNumber}-${h.hadithNumber}-${i}`}>
                    {h.exactNumber && <p className="text-xs text-noor-emeraldBright mb-1">{t("search.exactNo")}</p>}
                    <HadithCard hadith={h} />
                  </div>
                ))}
              </div>
              {type === "all" && data.hadith.length >= ALL_LIMIT && (
                <button onClick={() => setType("hadith")} className="mt-3 text-sm text-noor-goldBright underline">{t("search.moreHadith")}</button>
              )}
            </Section>
          )}

          {show("books") && (data.hadithBooks.length > 0 || data.errors.books || type === "books") && (
            <Section id="books" title={t("sf.books")} count={data.hadithBooks.length} failed={data.errors.books} onRetry={retry} empty={data.hadithBooks.length === 0 ? t("search.noBooks") : null}>
              <div className="space-y-2">
                {data.hadithBooks.map((b) => (
                  <Link key={b.to} to={b.to} className={cardCls}>
                    <div className="flex items-center justify-between gap-3">
                      <span>
                        <span className="text-xs text-noor-goldBright">{b.kind === "book" ? t("search.bookKind", { c: b.collectionName, n: b.bookNumber }) : t("search.collectionKind")}</span>
                        <span className="block">{lang === "ar" ? (b.name?.ar || b.name?.en || b.slug) : (b.name?.en || b.slug)}</span>
                      </span>
                      <span lang="ar" dir="rtl" className="font-arabic text-noor-goldBright">{b.name?.ar}</span>
                    </div>
                    {b.hadithCount != null && <p className="text-xs text-noor-textMuted mt-1">{t("hadith.count", { n: b.hadithCount })}</p>}
                  </Link>
                ))}
              </div>
            </Section>
          )}

          {show("tafseer") && (data.tafseer.sources.length > 0 || data.errors.tafseer || type === "tafseer") && (
            <Section id="tafseer" title={t("sf.tafseer")} count={data.tafseer.sources.length} failed={data.errors.tafseer} onRetry={retry}>
              {data.tafseer.sources.length > 0 && (
                <div className="space-y-2 mb-3">
                  {data.tafseer.sources.map((s) => (
                    <Link key={s.slug} to={s.to} className={cardCls}>
                      <span className="text-xs text-noor-goldBright">{t("search.tafseerSource")}{s.language ? ` · ${s.language}` : ""}</span>
                      <span className="block">{s.name}</span>
                    </Link>
                  ))}
                </div>
              )}
              <p className="text-xs text-noor-textMuted">{data.tafseer.note}</p>
            </Section>
          )}

          {show("duas") && (data.duas.length > 0 || data.duaCategories.length > 0 || data.errors.duas || type === "duas") && (
            <Section id="duas" title={t("sf.duas")} count={data.duasTotal + data.duaCategories.length} failed={data.errors.duas} onRetry={retry} empty={data.duas.length === 0 && data.duaCategories.length === 0 ? t("search.noDuas") : null}>
              {data.duaCategories.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {data.duaCategories.map((c) => <Link key={c.slug} to={c.to} className="px-3 py-1.5 rounded-full text-sm bg-noor-surface2 border border-noor-border hover:border-noor-gold">{t(`duas.cat.${c.slug}`) !== `duas.cat.${c.slug}` ? t("search.duasOf", { label: t(`duas.cat.${c.slug}`) }) : t("search.duasOf", { label: c.label })}</Link>)}
                </div>
              )}
              <div className="space-y-2">
                {data.duas.map((d, i) => (
                  <Link key={i} to={`/duas/${d.category}`} className={cardCls}>
                    <p className="text-xs text-noor-goldBright capitalize">{d.category.replace(/-/g, " ")}{d.custom ? ` · ${t("duas.addedBy")}` : ""}{d.source ? ` · ${d.source}` : ""}</p>
                    {d.ar && <p dir="rtl" lang="ar" className="font-arabic text-lg text-right mt-1"><Marked text={d.ar} query={data.query} /></p>}
                    {d.en && <p className="text-noor-textMuted text-sm mt-1"><Marked text={d.en} query={data.query} /></p>}
                    {d.ur && <p dir="rtl" lang="ur" className="font-urdu text-noor-textMuted text-sm mt-1 text-right"><Marked text={d.ur} query={data.query} /></p>}
                  </Link>
                ))}
              </div>
            </Section>
          )}

          {show("topics") && data.topics.length > 0 && (
            <Section id="topics" title={t("footer.topics")} count={data.topics.length}>
              <div className="flex flex-wrap gap-2">
                {data.topics.map((tp) => <Link key={tp.slug} to={tp.to} className="px-4 py-2 rounded-full text-sm bg-noor-surface2 border border-noor-border hover:border-noor-gold">{t(`topic.${tp.slug}`) !== `topic.${tp.slug}` ? t(`topic.${tp.slug}`) : tp.label}</Link>)}
              </div>
              <p className="text-xs text-noor-textMuted mt-2">{t("search.topicsNote")}</p>
            </Section>
          )}

          {show("pages") && data.pages.length > 0 && (
            <Section id="pages" title={t("search.pagesIn")} count={data.pages.length}>
              <div className="grid sm:grid-cols-2 gap-2">
                {data.pages.map((p) => (
                  <Link key={p.to} to={p.to} className={cardCls}>
                    <span className="block">{p.label}</span>
                    <span className="block text-xs text-noor-textMuted">{p.description}</span>
                  </Link>
                ))}
              </div>
            </Section>
          )}
        </div>
      )}
    </div>
  );
}
