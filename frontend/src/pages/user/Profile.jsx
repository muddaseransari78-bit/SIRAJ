import React, { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useI18n } from "../../context/I18nContext";
import useReadingSettings from "../../hooks/useReadingSettings";
import GlassCard from "../../components/GlassCard";
import { useToast } from "../../components/Toast";
import { LANGUAGES } from "../../i18n/translations";
import { fetchPreferences, savePreferences, updateProfileName, changePassword } from "../../services/contentService";

const errMsg = (e, fallback) => e.response?.data?.errors?.[0]?.message || e.response?.data?.message || fallback;

export default function Profile() {
  const { user, loading, logout, updateUser } = useAuth();
  const { lang, setLang, t, isRTL } = useI18n();
  const [reading, updateReading] = useReadingSettings();
  const { toastEl, notify } = useToast();

  const [name, setName] = useState("");
  const [language, setLanguage] = useState(lang);
  const [fontSize, setFontSize] = useState(reading.fontSize);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState("");

  useEffect(() => { if (user) setName(user.name); }, [user]);
  useEffect(() => {
    if (!user) return;
    // Show what is saved on the account
    fetchPreferences().then((p) => { setLanguage(p.language); if (p.arabicFontSize) setFontSize(p.arabicFontSize); }).catch(() => {});
  }, [user]);

  if (loading) return <p className="text-center py-24 text-noor-textMuted">{t("common.loading")}</p>;
  if (!user) return <Navigate to="/login" replace />;

  async function saveName(e) {
    e.preventDefault();
    setBusy("name");
    try { const u = await updateProfileName(name.trim()); updateUser({ name: u.name }); notify(t("prof.nameUpdated")); }
    catch (err) { notify(errMsg(err, t("prof.nameFail"))); }
    finally { setBusy(""); }
  }

  async function savePrefs(e) {
    e.preventDefault();
    setBusy("prefs");
    try {
      await savePreferences({ language, arabicFontSize: fontSize });
      setLang(language);                 // apply now
      updateReading({ fontSize });       // apply to the Quran reader in this browser
      notify(t("prof.prefsSaved"));
    } catch (err) { notify(errMsg(err, t("prof.prefsFail"))); }
    finally { setBusy(""); }
  }

  async function savePassword(e) {
    e.preventDefault();
    if (next.length < 8) return notify(t("prof.pwShort"));
    if (next !== confirm) return notify(t("prof.pwMismatch"));
    setBusy("pw");
    try { await changePassword(current, next); setCurrent(""); setNext(""); setConfirm(""); notify(t("prof.pwChanged")); }
    catch (err) { notify(errMsg(err, t("prof.pwFail"))); }
    finally { setBusy(""); }
  }

  const input = "w-full rounded-lg bg-noor-surface2 border border-noor-border px-3 py-2";
  const btn = "px-5 py-2 rounded-lg bg-noor-gold text-noor-onAccent text-sm font-medium disabled:opacity-50";

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 space-y-6">
      {toastEl}
      <div>
        <Link to="/dashboard" className="text-sm text-noor-textMuted hover:text-noor-goldBright">{isRTL ? "→" : "←"} {t("common.mySiraj")}</Link>
        <h1 className="text-3xl font-display text-noor-goldBright">{t("prof.title")}</h1>
      </div>

      <GlassCard>
        <h2 className="text-lg mb-3">{t("prof.account")}</h2>
        <p className="text-sm text-noor-textMuted mb-3">{t("prof.emailRole", { email: user.email, role: user.role })}</p>
        <form onSubmit={saveName} className="space-y-3">
          <label className="block text-sm"><span className="block text-noor-textMuted mb-1">{t("prof.name")}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className={input} required minLength={2} />
          </label>
          <button disabled={busy === "name"} className={btn}>{t("prof.saveName")}</button>
        </form>
      </GlassCard>

      <GlassCard>
        <h2 className="text-lg mb-3">{t("prof.prefs")}</h2>
        <form onSubmit={savePrefs} className="space-y-4">
          <label className="block text-sm"><span className="block text-noor-textMuted mb-1">{t("prof.language")}</span>
            <select value={language} onChange={(e) => setLanguage(e.target.value)} className={input}>
              {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </label>
          <label className="block text-sm"><span className="block text-noor-textMuted mb-1">{t("prof.fontSize", { n: fontSize })}</span>
            <input type="range" min="18" max="48" step="2" value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} className="w-full" />
          </label>
          <p dir="rtl" lang="ar" className="font-arabic text-right" style={{ fontSize }}>بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</p>
          <button disabled={busy === "prefs"} className={btn}>{t("prof.savePrefs")}</button>
          <p className="text-xs text-noor-textMuted">{t("prof.prefsNote")} <Link to="/prayer" className="text-noor-goldBright">{t("prof.prayerPage")}</Link>.</p>
        </form>
      </GlassCard>

      <GlassCard>
        <h2 className="text-lg mb-3">{t("prof.changePw")}</h2>
        <form onSubmit={savePassword} className="space-y-3">
          <label className="block text-sm"><span className="block text-noor-textMuted mb-1">{t("prof.currentPw")}</span>
            <input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className={input} required />
          </label>
          <label className="block text-sm"><span className="block text-noor-textMuted mb-1">{t("prof.newPw")}</span>
            <input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className={input} required minLength={8} />
          </label>
          <label className="block text-sm"><span className="block text-noor-textMuted mb-1">{t("prof.repeatPw")}</span>
            <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={input} required minLength={8} />
          </label>
          <button disabled={busy === "pw"} className={btn}>{t("prof.changePw")}</button>
        </form>
      </GlassCard>

      <button onClick={logout} className="px-4 py-2 rounded-full border border-noor-border text-sm hover:bg-noor-surface2">{t("dash.logout")}</button>
    </div>
  );
}
