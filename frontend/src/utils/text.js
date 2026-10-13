// Strips HTML tags from API bodies when only "body" (HTML) is available
export function plain(bundle) {
  if (!bundle) return "";
  if (typeof bundle === "string") return bundle;
  if (bundle.text) return bundle.text;
  if (bundle.body) return bundle.body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return "";
}
