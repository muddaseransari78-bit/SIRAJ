import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Mail, Lock, User } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useI18n } from "../../context/I18nContext";
import { apiErrorMessage } from "../../utils/apiError";
import { safeReturnPath } from "../../utils/feedbackForm";
import AuthShell from "../../components/auth/AuthShell";
import Field, { PasswordField } from "../../components/auth/Field";
import PressButton from "../../components/auth/PressButton";
import StrengthMeter from "../../components/auth/StrengthMeter";

export default function Register() {
  const { register } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const goBack = () => navigate(safeReturnPath(location.state && location.state.from));

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(form);
      goBack();
    } catch (err) {
      setError(apiErrorMessage(err, t("auth.registerFailed")));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title={t("auth.createTitle")}
      subtitle={t("auth.registerSub")}
      footer={
        <p className="text-sm text-noor-textMuted text-center mt-6">
          {t("auth.haveAccount")}{" "}
          <Link to="/login" state={location.state} className="text-noor-goldBright font-medium hover:underline">{t("auth.login")}</Link>
        </p>
      }
    >
      {error && (
        <p id="register-error" role="alert" className="auth-error text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field
          id="name"
          label={t("auth.fullName")}
          icon={User}
          type="text"
          name="name"
          autoComplete="name"
          maxLength={80}
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <Field
          id="email"
          label={t("auth.email")}
          icon={Mail}
          type="email"
          name="email"
          autoComplete="email"
          maxLength={254}
          required
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <div>
          <PasswordField
            id="password"
            label={t("auth.passwordMin")}
            icon={Lock}
            name="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={128}
            aria-describedby="password-rules"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <p id="password-rules" className="text-xs text-noor-textMuted mt-1.5">{t("auth.passwordRules")}</p>
          <StrengthMeter password={form.password} />
        </div>
        <PressButton type="submit" disabled={loading} loading={loading} className="mt-2">
          {loading ? t("auth.creating") : t("auth.register")}
        </PressButton>
        <p className="text-xs text-noor-textMuted text-center">
          {t("auth.agree")}{" "}
          <Link to="/terms" className="text-noor-goldBright hover:underline">{t("footer.terms")}</Link>
          {" · "}
          <Link to="/privacy" className="text-noor-goldBright hover:underline">{t("footer.privacy")}</Link>
        </p>
      </form>
    </AuthShell>
  );
}
