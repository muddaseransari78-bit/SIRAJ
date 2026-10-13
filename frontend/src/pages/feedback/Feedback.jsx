import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Star } from "lucide-react";
import GlassCard from "../../components/GlassCard";
import { SkeletonCard } from "../../components/Skeleton";
import { useAuth } from "../../context/AuthContext";
import { useI18n } from "../../context/I18nContext";
import { apiErrorMessage } from "../../utils/apiError";
import { fetchMyFeedback, submitFeedback } from "../../services/feedbackService";
import {
  FEATURE_OPTIONS, FEEDBACK_TYPES, MAX_TEXT, RECOMMEND_OPTIONS, buildPayload, emptyForm, toggleItem, validateForm,
} from "../../utils/feedbackForm";

function Chip({ active, onClick, children }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={`px-3 py-1.5 rounded-full text-sm border ${active ? "bg-noor-gold text-noor-onAccent border-noor-gold" : "bg-noor-surface2 border-noor-border"}`}>
      {children}
    </button>
  );
}

// 1 to 5 stars. Buttons (not a hidden input) so it works with keyboard and screen readers.
function Stars({ id, label, value, onChange, required }) {
  const { t } = useI18n();
  return (
    <fieldset className="space-y-1.5">
      <legend id={`${id}-label`} className="text-sm">{label}{required && <span className="text-red-400" aria-hidden="true"> *</span>}</legend>
      <div className="flex items-center gap-1" role="group" aria-labelledby={`${id}-label`} dir="ltr">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => onChange(value === n && !required ? 0 : n)} aria-pressed={value === n}
            aria-label={t("feedback.starsAria", { n })} className="p-1 rounded-md hover:bg-noor-surface2">
            <Star size={26} className={n <= value ? "text-noor-goldBright" : "text-noor-textMuted"} fill={n <= value ? "currentColor" : "none"} aria-hidden="true" />
          </button>
        ))}
        <span className="text-xs text-noor-textMuted ms-2" aria-live="polite">{value ? `${value}/5` : t("feedback.notRated")}</span>
      </div>
    </fieldset>
  );
}

function Counter({ value }) {
  return <p className="text-xs text-noor-textMuted text-end" dir="ltr">{value.length}/{MAX_TEXT}</p>;
}

const day = (iso, lang) => new Date(iso).toLocaleDateString(lang === "en" ? "en-GB" : lang, { day: "numeric", month: "short", year: "numeric" });

export default function Feedback() {
  const { user, loading } = useAuth();
  const { t, lang } = useI18n();
  const location = useLocation();
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [mine, setMine] = useState(null);

  const loadMine = () => fetchMyFeedback().then(setMine).catch(() => setMine([]));
  useEffect(() => { if (user) loadMine(); }, [user]);

  const setRating = (key) => (n) => setForm((f) => ({ ...f, ratings: { ...f.ratings, [key]: n } }));

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    const problem = validateForm(form);
    if (problem) { setError(t(problem)); return; }
    setSending(true);
    try {
      await submitFeedback(buildPayload(form));
      setSent(true);
      setForm(emptyForm());
      loadMine();
      window.scrollTo(0, 0);
    } catch (err) {
      setError(apiErrorMessage(err, t("feedback.sendFailed")));
    } finally {
      setSending(false);
    }
  }

  const shell = "max-w-2xl mx-auto px-4 py-12";

  if (loading) return <div className={shell}><SkeletonCard /></div>;

  // Feedback needs a login
  if (!user) {
    return (
      <div className={shell}>
        <h1 className="text-3xl font-display text-noor-goldBright mb-2">{t("feedback.title")}</h1>
        <GlassCard className="space-y-4 text-center mt-6">
          <p className="font-medium">{t("feedback.loginNeeded")}</p>
          <p className="text-sm text-noor-textMuted">{t("feedback.loginWhy")}</p>
          <div className="flex justify-center gap-3 pt-2">
            <Link to="/login" state={{ from: "/feedback" }} className="px-5 py-2 rounded-full bg-noor-gold text-noor-onAccent font-medium hover:bg-noor-goldBright">{t("nav.login")}</Link>
            <Link to="/register" state={{ from: "/feedback" }} className="px-5 py-2 rounded-full border border-noor-gold text-noor-goldBright hover:bg-noor-surface2">{t("nav.register")}</Link>
          </div>
        </GlassCard>
      </div>
    );
  }

  const needsText = form.type === "bug" || form.type === "content";
  const area = "mt-1 w-full rounded-lg bg-noor-surface2 border border-noor-border px-3 py-2 text-noor-text min-h-[110px]";

  return (
    <div className={shell}>
      <h1 className="text-3xl font-display text-noor-goldBright mb-2">{t("feedback.title")}</h1>
      <p className="text-noor-textMuted mb-6">{t("feedback.subtitle")}</p>

      {sent && (
        <p role="status" className="text-sm bg-noor-surface2 border border-noor-gold rounded-lg px-4 py-3 mb-6">{t("feedback.thanks")}</p>
      )}

      <form onSubmit={onSubmit} noValidate className="space-y-6">
        <GlassCard className="space-y-6">
          <fieldset className="space-y-2">
            <legend className="text-sm">{t("feedback.q.type")}</legend>
            <div className="flex flex-wrap gap-2" role="group">
              {FEEDBACK_TYPES.map((ty) => (
                <Chip key={ty} active={form.type === ty} onClick={() => setForm((f) => ({ ...f, type: ty }))}>{t(`feedback.type.${ty}`)}</Chip>
              ))}
            </div>
          </fieldset>

          <Stars id="r-overall" required label={t("feedback.q.overall")} value={form.ratings.overall} onChange={setRating("overall")} />
          <Stars id="r-ease" label={t("feedback.q.ease")} value={form.ratings.ease} onChange={setRating("ease")} />
          <Stars id="r-quran" label={t("feedback.q.quran")} value={form.ratings.quran} onChange={setRating("quran")} />
          <Stars id="r-audio" label={t("feedback.q.audio")} value={form.ratings.audio} onChange={setRating("audio")} />

          <fieldset className="space-y-2">
            <legend className="text-sm">{t("feedback.q.features")}</legend>
            <div className="flex flex-wrap gap-2" role="group">
              {FEATURE_OPTIONS.map(([id, key]) => (
                <Chip key={id} active={form.features.includes(id)} onClick={() => setForm((f) => ({ ...f, features: toggleItem(f.features, id) }))}>{t(key)}</Chip>
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm">{t("feedback.q.recommend")}<span className="text-red-400" aria-hidden="true"> *</span></legend>
            <div className="flex flex-wrap gap-2" role="group">
              {RECOMMEND_OPTIONS.map((r) => (
                <Chip key={r} active={form.recommend === r} onClick={() => setForm((f) => ({ ...f, recommend: r }))}>{t(`feedback.recommend.${r}`)}</Chip>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor="fb-improve" className="text-sm">{needsText ? t("feedback.q.problem") : t("feedback.q.improve")}{needsText && <span className="text-red-400" aria-hidden="true"> *</span>}</label>
            <textarea id="fb-improve" maxLength={MAX_TEXT} value={form.improve} onChange={(e) => setForm((f) => ({ ...f, improve: e.target.value }))} className={area} />
            <Counter value={form.improve} />
          </div>

          <div>
            <label htmlFor="fb-new" className="text-sm">{t("feedback.q.newFeature")}</label>
            <textarea id="fb-new" maxLength={MAX_TEXT} value={form.newFeature} onChange={(e) => setForm((f) => ({ ...f, newFeature: e.target.value }))} className={area} />
            <Counter value={form.newFeature} />
          </div>

          {error && <p role="alert" className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">{error}</p>}

          <button type="submit" disabled={sending} className="w-full py-2.5 rounded-full bg-noor-gold text-noor-onAccent font-medium hover:bg-noor-goldBright disabled:opacity-60">
            {sending ? t("feedback.sending") : t("feedback.send")}
          </button>
          <p className="text-xs text-noor-textMuted">{t("feedback.privacy", { name: user.name.split(" ")[0] })}</p>
        </GlassCard>
      </form>

      {mine && mine.length > 0 && (
        <section className="mt-10" aria-label={t("feedback.mine")}>
          <h2 className="text-lg mb-3">{t("feedback.mine")}</h2>
          <ul className="space-y-2">
            {mine.map((f) => (
              <li key={f._id} className="glass-card p-4 text-sm">
                <p className="text-xs text-noor-textMuted">{day(f.createdAt, lang)} · {t(`feedback.type.${f.type}`)} · <span dir="ltr">{"★".repeat(f.ratings.overall)}{"☆".repeat(5 - f.ratings.overall)}</span></p>
                {f.improve && <p className="mt-1 whitespace-pre-line">{f.improve}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
