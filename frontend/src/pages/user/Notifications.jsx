import React, { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Trash2, CheckCheck } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { ErrorState, SkeletonCard } from "../../components/Skeleton";
import {
  fetchNotifications, markNotificationRead, markAllNotificationsRead, deleteNotification,
} from "../../services/contentService";
import { useI18n } from "../../context/I18nContext";

export default function Notifications() {
  const { t, isRTL, locale } = useI18n();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  const [error, setError] = useState(false);

  const load = () => { setError(false); fetchNotifications().then((d) => setItems(d.notifications)).catch(() => setError(true)); };
  useEffect(() => { if (user) load(); }, [user]);

  if (loading) return <p className="text-center py-24 text-noor-textMuted">{t("common.loading")}</p>;
  if (!user) return <Navigate to="/login" replace />;

  const open = async (n) => {
    if (!n.read) {
      setItems((list) => list.map((x) => (x._id === n._id ? { ...x, read: true } : x)));
      markNotificationRead(n._id).catch(() => {});
    }
    if (n.link) navigate(n.link);
  };
  const readAll = async () => { await markAllNotificationsRead().catch(() => {}); setItems((list) => list.map((x) => ({ ...x, read: true }))); };
  const remove = async (id) => { await deleteNotification(id).catch(() => {}); setItems((list) => list.filter((x) => x._id !== id)); };
  const unread = items ? items.filter((n) => !n.read).length : 0;

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link to="/dashboard" className="text-sm text-noor-textMuted hover:text-noor-goldBright">{isRTL ? "→" : "←"} {t("common.mySiraj")}</Link>
          <h1 className="text-3xl font-display text-noor-goldBright">{t("notif.title")}</h1>
        </div>
        {unread > 0 && (
          <button onClick={readAll} className="flex items-center gap-2 text-sm px-4 py-2 rounded-full border border-noor-border hover:bg-noor-surface2">
            <CheckCheck size={16} aria-hidden="true" /> {t("notif.markAll")}
          </button>
        )}
      </div>

      {error && <ErrorState message={t("notif.loadError")} onRetry={load} />}
      {!items && !error && <SkeletonCard />}
      {items && items.length === 0 && <p className="text-noor-textMuted">{t("notif.empty")}</p>}
      <div className="space-y-2">
        {items?.map((n) => (
          <div key={n._id} className={`glass-card px-4 py-3 flex items-start gap-3 ${n.read ? "opacity-70" : "border-noor-gold"}`}>
            <button onClick={() => open(n)} className="flex-1 text-start">
              <p className="font-medium flex items-center gap-2">
                {!n.read && <span aria-label={t("notif.unread")} className="w-2 h-2 rounded-full bg-noor-gold inline-block" />}
                {n.title}
              </p>
              {n.body && <p className="text-sm text-noor-textMuted mt-1">{n.body}</p>}
              <p className="text-xs text-noor-textMuted mt-1">{new Date(n.createdAt).toLocaleString(locale)}</p>
            </button>
            <button aria-label={t("notif.delete")} onClick={() => remove(n._id)} className="text-noor-textMuted hover:text-red-400 mt-1"><Trash2 size={16} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
