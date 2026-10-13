import React, { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Target, Trash2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import GlassCard from "../../components/GlassCard";
import { ErrorState, SkeletonCard } from "../../components/Skeleton";
import { useToast } from "../../components/Toast";
import { fetchGoals, saveGoal, removeGoal } from "../../services/contentService";
import { useI18n } from "../../context/I18nContext";

function GoalRow({ type, label, max, goal, onSaved, notify }) {
  const { t } = useI18n();
  const [value, setValue] = useState(goal ? String(goal.target) : "");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setValue(goal ? String(goal.target) : ""); }, [goal?.target]);

  const save = async (e) => {
    e.preventDefault();
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1 || n > max) return notify(t("goals.enterNumber", { max }));
    setBusy(true);
    try { await saveGoal(type, n); notify(t("goals.saved")); await onSaved(); }
    catch (err) { notify(err.response?.data?.message || t("goals.saveFail")); }
    finally { setBusy(false); }
  };
  const remove = async () => { try { await removeGoal(type); notify(t("goals.removed")); await onSaved(); } catch (err) { notify(t("goals.removeFail")); } };
  const pct = goal ? Math.min(100, Math.round((goal.current / goal.target) * 100)) : 0;

  return (
    <GlassCard className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg flex items-center gap-2"><Target size={18} className="text-noor-goldBright" aria-hidden="true" />{label}</h2>
          <p className="text-xs text-noor-textMuted mt-1">{t(`goals.hint.${type}`)}</p>
        </div>
        {goal && <button aria-label={t("goals.remove", { label })} onClick={remove} className="text-noor-textMuted hover:text-red-400"><Trash2 size={16} /></button>}
      </div>

      {goal && (
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>{goal.current} / {goal.target}</span>
            <span className={goal.done ? "text-emerald-400" : "text-noor-textMuted"}>{goal.done ? t("goals.completed") : `${pct}%`}</span>
          </div>
          <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={t("goals.progress", { label })} className="h-2 rounded-full bg-noor-surface2 overflow-hidden">
            <div className="h-full bg-noor-gold transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      <form onSubmit={save} className="flex gap-2 items-center">
        <label className="sr-only" htmlFor={`goal-${type}`}>{t("goals.targetFor", { label })}</label>
        <input id={`goal-${type}`} type="number" min="1" max={max} value={value} onChange={(e) => setValue(e.target.value)} placeholder={t("goals.targetPh", { max })}
          className="w-40 rounded-lg bg-noor-surface2 border border-noor-border px-3 py-2 text-sm" />
        <button disabled={busy} className="px-4 py-2 rounded-lg bg-noor-gold text-noor-onAccent text-sm font-medium disabled:opacity-50">{goal ? t("goals.update") : t("goals.set")}</button>
      </form>
    </GlassCard>
  );
}

export default function Goals() {
  const { t, isRTL } = useI18n();
  const { user, loading } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const { toastEl, notify } = useToast();

  const load = () => fetchGoals().then((d) => { setData(d); setError(false); }).catch(() => setError(true));
  useEffect(() => { if (user) load(); }, [user]);

  if (loading) return <p className="text-center py-24 text-noor-textMuted">{t("common.loading")}</p>;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      {toastEl}
      <Link to="/dashboard" className="text-sm text-noor-textMuted hover:text-noor-goldBright">{isRTL ? "→" : "←"} {t("common.mySiraj")}</Link>
      <h1 className="text-3xl font-display text-noor-goldBright mb-2">{t("goals.title")}</h1>
      <p className="text-noor-textMuted mb-6">{t("goals.subtitle")}</p>
      {error && <ErrorState message={t("goals.loadError")} onRetry={load} />}
      {!data && !error && <SkeletonCard />}
      {data && (
        <div className="space-y-4">
          {data.availableTypes.map((a) => (
            <GoalRow key={a.type} type={a.type} label={t(`goals.label.${a.type}`)} max={a.max} goal={data.goals.find((g) => g.type === a.type)} onSaved={load} notify={notify} />
          ))}
        </div>
      )}
    </div>
  );
}
