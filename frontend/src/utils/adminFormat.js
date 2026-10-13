// Small pure helpers for the admin portal (no React, easy to test).

/** 125 -> "2 min", 7500 -> "2 h 5 min", 200000 -> "2 d 7 h". */
export function formatUptime(totalSeconds) {
  const s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d} d ${h} h`;
  if (h > 0) return `${h} h ${m} min`;
  return `${m} min`;
}

// A cell that starts with = + - @ can be run as a formula when the CSV is opened in Excel. A leading ' stops that.
function safeCell(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return String(value);
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[",\n\r]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

/** rows: array of objects; columns: [{ key, label }] -> CSV text with a header line. */
export function toCsv(rows, columns) {
  const header = columns.map((c) => safeCell(c.label)).join(",");
  const lines = rows.map((r) => columns.map((c) => safeCell(r[c.key])).join(","));
  return [header, ...lines].join("\n");
}

/** Names for the audit log actions. Unknown actions are shown as they are. */
const ACTION_LABELS = {
  USER_ACTIVATE: "Account activated",
  USER_DEACTIVATE: "Account deactivated",
  ROLE_CHANGE: "Role changed",
  BROADCAST: "Notification sent to all users",
  SETTINGS_UPDATE: "Website settings changed",
  CACHE_CLEAR: "Content cache cleared",
  ERROR_LOGS_CLEAR: "Error logs cleared",
  DUA_DELETE: "Dua deleted",
};
export const actionLabel = (action) => ACTION_LABELS[action] || action;

/** Colour class for a health level coming from the backend: ok | check | problem. */
export function healthClass(level) {
  if (level === "ok") return "text-noor-emeraldBright";
  if (level === "check") return "text-noor-goldBright";
  return "text-red-400";
}

/** "2026-10-03" -> "03 Oct". Same text in every time zone. */
export function shortDay(iso) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });
}
