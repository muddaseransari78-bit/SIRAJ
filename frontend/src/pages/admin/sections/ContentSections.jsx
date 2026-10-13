import React, { useEffect, useState } from "react";
import {
  adminAnnouncements, adminAddAnnouncement, adminToggleAnnouncement, adminDeleteAnnouncement, adminBroadcast, adminBroadcastHistory,
  adminDuas, adminSaveDua, adminToggleDua, adminDeleteDua, adminDuaCategories,
  adminReminders, adminAddReminder, adminToggleReminder, adminDeleteReminder,
  adminErrorLogs, adminClearErrorLogs,
} from "../../../services/contentService";

const inputCls = "w-full rounded-lg bg-noor-surface2 border border-noor-border px-3 py-2";
const apiMsg = (e, fallback) => e.response?.data?.message || fallback;
const EMPTY_DUA = { category: "", title: "", arabic: "", transliteration: "", urdu: "", english: "", source: "" };


export function Announcements() {
  const [items, setItems] = useState([]); const [title, setTitle] = useState(""); const [body, setBody] = useState("");
  const load = () => adminAnnouncements().then(setItems).catch(() => {});
  useEffect(() => { load(); }, []);
  const add = async (e) => { e.preventDefault(); if (!title || !body) return; await adminAddAnnouncement({ title, body }); setTitle(""); setBody(""); load(); };
  return (
    <div className="space-y-6">
      <form onSubmit={add} className="glass-card p-5 space-y-3">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" maxLength={120} className="w-full rounded-lg bg-noor-surface2 border border-noor-border px-3 py-2" />
        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Message shown on the home page" maxLength={1000} rows={3} className="w-full rounded-lg bg-noor-surface2 border border-noor-border px-3 py-2" />
        <button className="px-5 py-2 rounded-full bg-noor-gold text-noor-onAccent font-medium">Publish announcement</button>
      </form>
      <div className="space-y-2">
        {items.map((a) => (
          <div key={a._id} className="glass-card px-4 py-3 flex justify-between gap-3 text-sm">
            <div><p className="font-medium">{a.title} {!a.isActive && <span className="text-xs text-noor-textMuted">(hidden)</span>}</p><p className="text-noor-textMuted">{a.body}</p></div>
            <div className="flex gap-2 items-start shrink-0">
              <button onClick={() => adminToggleAnnouncement(a._id, !a.isActive).then(load)} className="text-xs px-3 py-1 rounded-full border border-noor-border">{a.isActive ? "Hide" : "Show"}</button>
              <button onClick={() => adminDeleteAnnouncement(a._id).then(load)} className="text-xs px-3 py-1 rounded-full border border-red-800 text-red-400">Delete</button>
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-noor-textMuted text-sm">No announcements yet.</p>}
      </div>
    </div>
  );
}

export function DuasAdmin() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(EMPTY_DUA);
  const [editId, setEditId] = useState(null);
  const [msg, setMsg] = useState("");
  const [cats, setCats] = useState([]);
  const load = () => {
    adminDuas().then(setItems).catch(() => setMsg("Unable to load Duas."));
    adminDuaCategories().then(setCats).catch(() => {});
  };
  useEffect(() => { load(); }, []);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const save = async (e) => {
    e.preventDefault(); setMsg("");
    try { await adminSaveDua(editId, form); setForm(EMPTY_DUA); setEditId(null); setMsg(editId ? "Dua updated." : "Dua added."); load(); }
    catch (err) { setMsg(apiMsg(err, "Could not save the Dua.")); }
  };
  const edit = (d) => { setEditId(d._id); setForm({ category: d.category, title: d.title || "", arabic: d.arabic, transliteration: d.transliteration || "", urdu: d.urdu || "", english: d.english || "", source: d.source }); window.scrollTo(0, 0); };
  return (
    <div className="space-y-6">
      <p className="text-sm text-noor-textMuted">Add SIRAJ Duas. They appear next to the Hisn al-Muslim Duas in the same category. A source is required. Quran and Hadith data cannot be edited here.</p>
      {cats.length > 0 && (
        <div className="glass-card p-4">
          <p className="text-xs text-noor-textMuted mb-2">Categories of SIRAJ Duas (tap one to use it in the form)</p>
          <div className="flex flex-wrap gap-2">
            {cats.map((c) => (
              <button key={c.category} type="button" onClick={() => setForm((f) => ({ ...f, category: c.category }))}
                className="px-3 py-1 rounded-full border border-noor-border text-xs hover:text-noor-goldBright">
                {c.category} · {c.visible}{c.visible !== c.total ? `/${c.total}` : ""}
              </button>
            ))}
          </div>
        </div>
      )}
      <form onSubmit={save} className="glass-card p-5 space-y-3">
        <h2 className="text-lg">{editId ? "Edit Dua" : "Add a Dua"}</h2>
        <input value={form.category} onChange={set("category")} placeholder="Category, e.g. ramadan, morning, travel" maxLength={40} required className={inputCls} />
        <input value={form.title} onChange={set("title")} placeholder="Title (optional)" maxLength={120} className={inputCls} />
        <textarea dir="rtl" lang="ar" value={form.arabic} onChange={set("arabic")} placeholder="Arabic text" rows={3} maxLength={2000} required className={`${inputCls} font-arabic text-xl`} />
        <textarea value={form.transliteration} onChange={set("transliteration")} placeholder="Transliteration (optional)" rows={2} maxLength={2000} className={inputCls} />
        <textarea value={form.english} onChange={set("english")} placeholder="English translation" rows={2} maxLength={2000} className={inputCls} />
        <textarea dir="rtl" lang="ur" value={form.urdu} onChange={set("urdu")} placeholder="اردو ترجمہ" rows={2} maxLength={2000} className={inputCls} />
        <input value={form.source} onChange={set("source")} placeholder="Source / reference (required), e.g. Sahih Muslim 2717" maxLength={300} required className={inputCls} />
        <div className="flex gap-2">
          <button className="px-5 py-2 rounded-full bg-noor-gold text-noor-onAccent font-medium">{editId ? "Save changes" : "Add Dua"}</button>
          {editId && <button type="button" onClick={() => { setEditId(null); setForm(EMPTY_DUA); }} className="px-5 py-2 rounded-full border border-noor-border">Cancel</button>}
        </div>
        {msg && <p role="status" className="text-sm text-noor-goldBright">{msg}</p>}
      </form>
      <div className="space-y-2">
        {items.map((d) => (
          <div key={d._id} className="glass-card px-4 py-3 flex justify-between gap-3 text-sm">
            <div className="min-w-0">
              <p className="text-xs text-noor-goldBright">{d.category}{!d.isActive && <span className="text-noor-textMuted"> (hidden)</span>}</p>
              <p dir="rtl" lang="ar" className="font-arabic text-lg truncate">{d.arabic}</p>
              <p className="text-noor-textMuted truncate">{d.english || d.urdu}</p>
              <p className="text-xs text-noor-textMuted">Source: {d.source}</p>
            </div>
            <div className="flex gap-2 items-start shrink-0">
              <button onClick={() => edit(d)} className="text-xs px-3 py-1 rounded-full border border-noor-border">Edit</button>
              <button onClick={() => adminToggleDua(d._id, !d.isActive).then(load)} className="text-xs px-3 py-1 rounded-full border border-noor-border">{d.isActive ? "Hide" : "Show"}</button>
              <button onClick={() => window.confirm("Delete this Dua?") && adminDeleteDua(d._id).then(load)} className="text-xs px-3 py-1 rounded-full border border-red-800 text-red-400">Delete</button>
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-noor-textMuted text-sm">No SIRAJ Duas yet.</p>}
      </div>
    </div>
  );
}

export function RemindersAdmin() {
  const [items, setItems] = useState([]);
  const [text, setText] = useState(""); const [source, setSource] = useState(""); const [msg, setMsg] = useState("");
  const load = () => adminReminders().then(setItems).catch(() => setMsg("Unable to load reminders."));
  useEffect(() => { load(); }, []);
  const add = async (e) => {
    e.preventDefault(); setMsg("");
    try { await adminAddReminder({ text, source }); setText(""); setSource(""); load(); }
    catch (err) { setMsg(apiMsg(err, "Could not add the reminder.")); }
  };
  return (
    <div className="space-y-6">
      <p className="text-sm text-noor-textMuted">One active reminder is shown on the Home page each day (they rotate daily). A source is required.</p>
      <form onSubmit={add} className="glass-card p-5 space-y-3">
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Reminder text" rows={3} maxLength={400} required className={inputCls} />
        <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="Source / reference (required)" maxLength={300} required className={inputCls} />
        <button className="px-5 py-2 rounded-full bg-noor-gold text-noor-onAccent font-medium">Add reminder</button>
        {msg && <p role="status" className="text-sm text-red-400">{msg}</p>}
      </form>
      <div className="space-y-2">
        {items.map((r) => (
          <div key={r._id} className="glass-card px-4 py-3 flex justify-between gap-3 text-sm">
            <div><p>{r.text} {!r.isActive && <span className="text-xs text-noor-textMuted">(hidden)</span>}</p><p className="text-xs text-noor-goldBright">{r.source}</p></div>
            <div className="flex gap-2 items-start shrink-0">
              <button onClick={() => adminToggleReminder(r._id, !r.isActive).then(load)} className="text-xs px-3 py-1 rounded-full border border-noor-border">{r.isActive ? "Hide" : "Show"}</button>
              <button onClick={() => window.confirm("Delete this reminder?") && adminDeleteReminder(r._id).then(load)} className="text-xs px-3 py-1 rounded-full border border-red-800 text-red-400">Delete</button>
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-noor-textMuted text-sm">No reminders yet.</p>}
      </div>
    </div>
  );
}

export function ErrorLogs({ me }) {
  const [data, setData] = useState(null); const [err, setErr] = useState(false);
  const load = () => { setErr(false); adminErrorLogs().then(setData).catch(() => setErr(true)); };
  useEffect(load, []);
  if (err) return <p className="text-red-400">Unable to load error logs.</p>;
  if (!data) return <p className="text-noor-textMuted">Loading…</p>;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-noor-textMuted">Server errors (status 500 and above) from the last 30 days. Last 24 hours: <strong className="text-noor-goldBright">{data.last24h}</strong>. No request data or passwords are stored.</p>
        <div className="flex gap-2 shrink-0">
          <button onClick={load} className="text-xs px-3 py-1 rounded-full border border-noor-border">Refresh</button>
          {me.role === "SUPER_ADMIN" && <button onClick={() => window.confirm("Clear ALL error logs?") && adminClearErrorLogs().then(load)} className="text-xs px-3 py-1 rounded-full border border-red-800 text-red-400">Clear</button>}
        </div>
      </div>
      <div className="space-y-2">
        {data.logs.map((l) => (
          <div key={l._id} className="glass-card px-4 py-3 text-sm">
            <p><span className="text-red-400">{l.statusCode}</span> <span className="text-noor-goldBright">{l.method}</span> {l.path}</p>
            <p className="text-noor-textMuted break-words">{l.message}</p>
            <p className="text-xs text-noor-textMuted">{new Date(l.createdAt).toLocaleString()}</p>
          </div>
        ))}
        {data.logs.length === 0 && <p className="text-noor-textMuted text-sm">No errors recorded. 🎉</p>}
      </div>
    </div>
  );
}

export function Broadcast() {
  const [title, setTitle] = useState(""); const [body, setBody] = useState(""); const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState("");
  const [history, setHistory] = useState(null);
  const loadHistory = () => adminBroadcastHistory().then(setHistory).catch(() => setHistory([]));
  useEffect(() => { loadHistory(); }, []);
  const send = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (!window.confirm("Send this notification to ALL active users? This cannot be undone.")) return;
    setBusy(true); setMsg("");
    try {
      const r = await adminBroadcast({ title: title.trim(), body: body.trim(), link: link.trim() });
      setMsg(r.message); setTitle(""); setBody(""); setLink(""); setTimeout(loadHistory, 600);
    } catch (err) { setMsg(err.response?.data?.message || "Could not send."); }
    finally { setBusy(false); }
  };
  return (
    <div className="space-y-6">
    <form onSubmit={send} className="glass-card p-5 space-y-3 max-w-xl">
      <p className="text-sm text-noor-textMuted">Sends an in-app notification (bell icon) to every active user. Use sparingly.</p>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" maxLength={120} required className="w-full rounded-lg bg-noor-surface2 border border-noor-border px-3 py-2" />
      <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Message (optional)" maxLength={500} rows={3} className="w-full rounded-lg bg-noor-surface2 border border-noor-border px-3 py-2" />
      <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Optional in-app link, e.g. /ramadan" className="w-full rounded-lg bg-noor-surface2 border border-noor-border px-3 py-2" />
      <button disabled={busy} className="px-5 py-2 rounded-full bg-noor-gold text-noor-onAccent font-medium disabled:opacity-50">Send to all users</button>
      {msg && <p role="status" className="text-sm text-noor-goldBright">{msg}</p>}
    </form>
    <div className="max-w-xl">
      <h2 className="text-lg mb-2">Recently sent</h2>
      {history === null && <p className="text-sm text-noor-textMuted">Loading…</p>}
      {history && history.length === 0 && <p className="text-sm text-noor-textMuted">Nothing sent yet.</p>}
      <ul className="space-y-2">
        {history && history.map((h) => (
          <li key={h._id} className="glass-card px-4 py-3 text-sm">
            <p>{h.target}</p>
            <p className="text-xs text-noor-textMuted">{h.detail} · by {h.actorName || "admin"} · {new Date(h.createdAt).toLocaleString()}</p>
          </li>
        ))}
      </ul>
    </div>
    </div>
  );
}

