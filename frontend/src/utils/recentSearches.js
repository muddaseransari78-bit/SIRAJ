// "Recent searches" are kept ONLY in this browser (localStorage). They are never sent to the server.

const KEY = "siraj_recent_searches";
export const MAX_RECENT = 8;

// Pure: returns a new list with `q` first, no duplicates (case-insensitive), at most `max` items.
export function addToRecent(list, q, max = MAX_RECENT) {
  const clean = String(q || "").replace(/\s+/g, " ").trim().slice(0, 100);
  if (clean.length < 2) return list;
  const rest = list.filter((x) => x.toLowerCase() !== clean.toLowerCase());
  return [clean, ...rest].slice(0, max);
}

// localStorage can be missing (private mode) or hold garbage - never throw.
export function loadRecent(storage = typeof localStorage !== "undefined" ? localStorage : null) {
  try {
    const parsed = JSON.parse(storage?.getItem(KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string").slice(0, MAX_RECENT) : [];
  } catch (e) {
    return [];
  }
}

export function saveRecent(list, storage = typeof localStorage !== "undefined" ? localStorage : null) {
  try { storage?.setItem(KEY, JSON.stringify(list.slice(0, MAX_RECENT))); } catch (e) { /* ignore */ }
}

export function rememberSearch(q, storage) {
  const next = addToRecent(loadRecent(storage), q);
  saveRecent(next, storage);
  return next;
}

export function clearRecent(storage = typeof localStorage !== "undefined" ? localStorage : null) {
  try { storage?.removeItem(KEY); } catch (e) { /* ignore */ }
  return [];
}
