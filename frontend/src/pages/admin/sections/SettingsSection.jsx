import React, { useEffect, useState } from "react";
import { ErrorState, SkeletonCard } from "../../../components/Skeleton";
import useLoad from "../../../hooks/useLoad";
import { adminGetSettings, adminSaveSettings } from "../../../services/contentService";

function Toggle({ id, label, help, checked, onChange, disabled }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <label htmlFor={id} className="text-sm">{label}</label>
        <p className="text-xs text-noor-textMuted">{help}</p>
      </div>
      <input id={id} type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="mt-1 h-5 w-5 accent-noor-gold" />
    </div>
  );
}

export default function SettingsSection({ me }) {
  const { data, error, reload } = useLoad(adminGetSettings);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const canEdit = me.role === "SUPER_ADMIN";

  useEffect(() => { if (data) setForm(data); }, [data]);

  if (error) return <ErrorState message="Unable to load the settings. Please try again." onRetry={reload} />;
  if (!form) return <SkeletonCard />;

  const save = async (e) => {
    e.preventDefault();
    if (!form.registrationEnabled && data.registrationEnabled && !window.confirm("Close new registrations? Nobody will be able to create an account until you switch this on again.")) return;
    setBusy(true); setMsg("");
    try {
      const saved = await adminSaveSettings({ registrationEnabled: form.registrationEnabled, ramadanEnabled: form.ramadanEnabled, siteNotice: form.siteNotice });
      setForm(saved); setMsg("Settings saved. They reach visitors within a few seconds.");
    } catch (err) { setMsg(err.response?.data?.message || "Could not save the settings."); }
    finally { setBusy(false); }
  };

  return (
    <form onSubmit={save} className="glass-card p-5 space-y-5 max-w-2xl">
      {!canEdit && <p className="text-sm text-noor-goldBright">Only a Super Admin can change these settings. You can view them here.</p>}

      <Toggle id="reg" label="Allow new registrations" help="When off, the Register page shows a message and no new accounts can be created. Existing users can still log in."
        checked={form.registrationEnabled} disabled={!canEdit} onChange={(v) => setForm({ ...form, registrationEnabled: v })} />
      <Toggle id="ram" label="Ramadan features" help="When off, the Ramadan page (Sehri/Iftar, fasting tracker, Quran plan) and its API are switched off. Nothing is deleted."
        checked={form.ramadanEnabled} disabled={!canEdit} onChange={(v) => setForm({ ...form, ramadanEnabled: v })} />

      <div>
        <label htmlFor="notice" className="text-sm">Site notice</label>
        <p className="text-xs text-noor-textMuted mb-2">A short message shown at the top of every page (for example planned maintenance). Leave empty to hide it.</p>
        <textarea id="notice" rows={2} maxLength={200} value={form.siteNotice} disabled={!canEdit} onChange={(e) => setForm({ ...form, siteNotice: e.target.value })}
          className="w-full rounded-lg bg-noor-surface2 border border-noor-border px-3 py-2 text-sm" />
        <p className="text-xs text-noor-textMuted text-right">{form.siteNotice.length}/200</p>
      </div>

      {canEdit && <button disabled={busy} className="px-5 py-2 rounded-full bg-noor-gold text-noor-onAccent font-medium disabled:opacity-50">Save settings</button>}
      {msg && <p role="status" className="text-sm text-noor-goldBright">{msg}</p>}
    </form>
  );
}
