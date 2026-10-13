import React, { useEffect, useState } from "react";
import { ErrorState, SkeletonCard } from "../../../components/Skeleton";
import useLoad from "../../../hooks/useLoad";
import { adminUsers, adminSetActive, adminSetRole, adminUserDetail } from "../../../services/contentService";

const inputCls = "rounded-lg bg-noor-surface2 border border-noor-border px-3 py-2 text-sm";
const day = (iso) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

function Fact({ label, value }) {
  return <div><dt className="text-xs text-noor-textMuted">{label}</dt><dd className="text-lg font-display">{value}</dd></div>;
}

function UserDetail({ id, onClose }) {
  const { data, error, reload } = useLoad(() => adminUserDetail(id), [id]);
  return (
    <section aria-label="User details" className="glass-card p-5 space-y-4 border-noor-gold">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg">{data ? data.user.name : "User details"}</h2>
          {data && <p className="text-xs text-noor-textMuted">{data.user.email} · {data.user.role} · {data.user.isActive ? "active" : "deactivated"} · joined {day(data.user.createdAt)}</p>}
        </div>
        <button onClick={onClose} className="text-xs px-3 py-1 rounded-full border border-noor-border">Close</button>
      </div>
      {error && <ErrorState message="Unable to load this user." onRetry={reload} />}
      {!data && !error && <SkeletonCard />}
      {data && (
        <>
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Fact label="Last active" value={data.stats.lastActiveDate || "—"} />
            <Fact label="Reading days" value={data.stats.readingDays} />
            <Fact label="Surahs / Juz done" value={`${data.stats.surahsCompleted} / ${data.stats.juzCompleted}`} />
            <Fact label="Khatm completed" value={data.stats.khatmCount} />
            <Fact label="Saved items" value={data.stats.bookmarks.total} />
            <Fact label="Notes" value={data.stats.notes} />
            <Fact label="Tasbeeh sessions" value={`${data.stats.tasbeehSessions} (${data.stats.tasbeehCount})`} />
            <Fact label="Prayers logged" value={data.stats.prayersLogged} />
          </dl>
          <p className="text-xs text-noor-textMuted">
            {data.stats.lastRead ? `Last read: Surah ${data.stats.lastRead.surah}, Ayah ${data.stats.lastRead.ayah}. ` : ""}
            Goals set: {data.stats.goals}. Admins only see counts — a user’s notes, saved items and prayer records stay private.
          </p>
        </>
      )}
    </section>
  );
}

export default function UsersSection({ me }) {
  const [form, setForm] = useState({ q: "", role: "", status: "" });
  const [applied, setApplied] = useState(form);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [msg, setMsg] = useState("");
  const { data, error, reload, setData } = useLoad(() => adminUsers({ ...applied, page }), [applied, page]);

  useEffect(() => { setMsg(""); }, [applied, page]);

  const submit = (e) => { e.preventDefault(); setPage(1); setApplied(form); };
  const fail = (e) => setMsg(e.response?.data?.message || "Action failed.");
  const replace = (u) => setData((d) => ({ ...d, users: d.users.map((x) => (x._id === u._id ? u : x)) }));

  const toggleActive = (u) => {
    if (u.isActive && !window.confirm(`Deactivate ${u.email}? They will not be able to log in.`)) return;
    adminSetActive(u._id, !u.isActive).then(replace).catch(fail);
  };
  const changeRole = (u, role) => {
    if (!window.confirm(`Change ${u.email} from ${u.role} to ${role}?`)) return;
    adminSetRole(u._id, role).then(replace).catch(fail);
  };

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="flex flex-wrap gap-2" role="search" aria-label="Find users">
        <input value={form.q} onChange={(e) => setForm({ ...form, q: e.target.value })} placeholder="Search name or email" aria-label="Search name or email" className={`${inputCls} flex-1 min-w-[180px]`} />
        <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} aria-label="Filter by role" className={inputCls}>
          <option value="">All roles</option><option value="USER">User</option><option value="ADMIN">Admin</option><option value="SUPER_ADMIN">Super Admin</option>
        </select>
        <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} aria-label="Filter by status" className={inputCls}>
          <option value="">Any status</option><option value="active">Active</option><option value="inactive">Deactivated</option>
        </select>
        <button className="px-4 rounded-lg bg-noor-gold text-noor-onAccent text-sm">Search</button>
      </form>

      {selected && <UserDetail id={selected} onClose={() => setSelected(null)} />}
      {msg && <p role="alert" className="text-sm text-red-400">{msg}</p>}
      {error && <ErrorState message="Unable to load users. Please try again." onRetry={reload} />}
      {!data && !error && <SkeletonCard />}
      {data && data.users.length === 0 && <p className="text-sm text-noor-textMuted">No users match these filters.</p>}

      <div className="space-y-2">
        {data?.users.map((u) => (
          <div key={u._id} className="glass-card px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-sm">
            <div>
              <p className="font-medium">{u.name} {!u.isActive && <span className="text-red-400 text-xs">(deactivated)</span>}</p>
              <p className="text-xs text-noor-textMuted">{u.email} • joined {day(u.createdAt)}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setSelected(u._id)} className="px-3 py-1 rounded-full border border-noor-border text-xs">Details</button>
              {me.role === "SUPER_ADMIN" ? (
                <select value={u.role} onChange={(e) => changeRole(u, e.target.value)} aria-label={`Role of ${u.email}`}
                  className="rounded bg-noor-surface2 border border-noor-border px-2 py-1 text-xs" disabled={u._id === me.id}>
                  <option>USER</option><option>ADMIN</option><option>SUPER_ADMIN</option>
                </select>
              ) : <span className="text-xs text-noor-goldBright">{u.role}</span>}
              <button disabled={u._id === me.id || (u.role !== "USER" && me.role !== "SUPER_ADMIN")} onClick={() => toggleActive(u)}
                className="px-3 py-1 rounded-full border border-noor-border text-xs disabled:opacity-40">{u.isActive ? "Deactivate" : "Activate"}</button>
            </div>
          </div>
        ))}
      </div>

      {data && (
        <div className="flex justify-between mt-2 text-sm">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1 rounded-full bg-noor-surface2 disabled:opacity-40">← Prev</button>
          <span className="text-noor-textMuted">Page {data.page} of {data.pages || 1} • {data.total} users</span>
          <button disabled={page >= data.pages} onClick={() => setPage(page + 1)} className="px-3 py-1 rounded-full bg-noor-surface2 disabled:opacity-40">Next →</button>
        </div>
      )}
    </div>
  );
}
