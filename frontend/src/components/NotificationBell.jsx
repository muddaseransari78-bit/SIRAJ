import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { fetchUnreadCount } from "../services/contentService";
import { useI18n } from "../context/I18nContext";

// Bell icon with unread badge. Checks the server once a minute while the tab is visible.
export default function NotificationBell() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) { setCount(0); return undefined; }
    let stopped = false;
    const load = () => {
      if (document.hidden) return;
      fetchUnreadCount().then((n) => { if (!stopped) setCount(n); }).catch(() => {});
    };
    load();
    const timer = setInterval(load, 60000);
    return () => { stopped = true; clearInterval(timer); };
  }, [user]);

  if (!user) return null;
  return (
    <Link to="/notifications" aria-label={count ? t("notif.bellUnread", { n: count }) : t("notif.bellAria")} className="relative p-2 rounded-full hover:bg-noor-surface2">
      <Bell size={18} />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-noor-gold text-noor-onAccent text-[10px] font-bold flex items-center justify-center">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
