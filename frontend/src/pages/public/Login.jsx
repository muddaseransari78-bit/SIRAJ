import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Mail, Lock } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useI18n } from "../../context/I18nContext";
import { apiErrorMessage } from "../../utils/apiError";
import { safeReturnPath } from "../../utils/feedbackForm";
import AuthShell from "../../components/auth/AuthShell";
import Field, { PasswordField } from "../../components/auth/Field";
import PressButton from "../../components/auth/PressButton";

export default function Login() {
  const { login } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const goBack = () => navigate(safeReturnPath(location.state && location.state.from));

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(form);
      goBack();
    } catch (err) {
      setError(apiErrorMessage(err, t("auth.loginFailed")));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title={t("auth.welcomeBack")}
      subtitle={t("auth.loginSub")}
      footer={
        <p className="text-sm text-noor-textMuted text-center mt-6">
          {t("auth.noAccount")}{" "}
          <Link to="/register" state={location.state} className="text-noor-goldBright font-medium hover:underline">{t("auth.register")}</Link>
        </p>
      }
    >
      {error && (
        <p id="login-error" role="alert" className="auth-error text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field
          id="email"
          label={t("auth.email")}
          icon={Mail}
          type="email"
          name="email"
          autoComplete="email"
          required
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error ? "login-error" : undefined}
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <PasswordField
          id="password"
          label={t("auth.password")}
          icon={Lock}
          name="password"
          autoComplete="current-password"
          maxLength={128}
          required
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error ? "login-error" : undefined}
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        <PressButton type="submit" disabled={loading} loading={loading} className="mt-2">
          {loading ? t("auth.loggingIn") : t("auth.login")}
        </PressButton>
      </form>
    </AuthShell>
  );
}
