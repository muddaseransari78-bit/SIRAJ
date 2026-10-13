import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useI18n } from "../../context/I18nContext";

// Input with an icon and a label that floats up when you type (styles: .auth-field in index.css).
// The input must come BEFORE the label in the markup: the CSS uses the "next sibling" selector.
export default function Field({ id, label, icon: Icon, endSlot = null, className = "", ...rest }) {
  return (
    <div className="auth-field">
      <input id={id} placeholder=" " className={`auth-input ${className}`} {...rest} />
      <label htmlFor={id} className="auth-label">{label}</label>
      {Icon && <Icon size={18} className="auth-icon" aria-hidden="true" />}
      {endSlot}
    </div>
  );
}

export function PasswordField({ id, label, icon, ...rest }) {
  const { t } = useI18n();
  const [shown, setShown] = useState(false);
  return (
    <Field
      id={id}
      label={label}
      icon={icon}
      type={shown ? "text" : "password"}
      endSlot={
        <button
          type="button"
          className="auth-eye"
          onClick={() => setShown((v) => !v)}
          aria-label={shown ? t("auth.hidePassword") : t("auth.showPassword")}
          aria-pressed={shown}
        >
          {shown ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      }
      {...rest}
    />
  );
}
