import React, { useState } from "react";
import { ErrorState, SkeletonCard } from "../../../components/Skeleton";
import useLoad from "../../../hooks/useLoad";
import { adminSources, adminClearCache } from "../../../services/contentService";

const INTRO = {
  quran: "The Quran text is never stored or edited in SIRAJ. It is fetched from the provider below, checked, and cached for 24 hours. Every layer shows its source in the reader.",
  hadith: "Hadith are never stored or edited in SIRAJ. They are fetched from the provider below and always shown with their collection, book and number.",
  tafseer: "Tafseer texts are never stored or edited in SIRAJ. They are fetched from the provider below and shown together with the Tafseer’s name.",
};

export default function SourcesSection({ kind, me, goTab }) {
  const { data, error, reload } = useLoad(adminSources);
  const [msg, setMsg] = useState("");

  if (error) return <ErrorState message="Unable to load the source information. Please try again." onRetry={reload} />;
  if (!data) return <SkeletonCard />;
  const block = data[kind];

  const clear = async () => {
    if (!window.confirm("Clear the content cache? The next visits will fetch fresh data from the providers (a little slower).")) return;
    try { const r = await adminClearCache(); setMsg(r.message); reload(); }
    catch (e) { setMsg(e.response?.data?.message || "Could not clear the cache."); }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-noor-textMuted">{INTRO[kind]}</p>

      <div className="glass-card p-5 space-y-3">
        <p className="text-sm">Provider: <span className="text-noor-goldBright">{block.provider}</span></p>
        <ul className="space-y-2 text-sm">
          {block.layers.map((l) => (
            <li key={l.name}><span className="block">{l.name}</span><span className="text-xs text-noor-textMuted">{l.source}</span></li>
          ))}
        </ul>
        <button onClick={() => goTab("api-status")} className="text-xs text-noor-goldBright">Check if the provider is online →</button>
      </div>

      {kind === "tafseer" && (
        <div className="glass-card p-5">
          <p className="text-sm mb-2">Available Tafseer ({block.sources.length})</p>
          {block.sources.length === 0 && <p className="text-xs text-noor-textMuted">The list could not be loaded right now.</p>}
          <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm max-h-72 overflow-y-auto">
            {block.sources.map((t) => (
              <li key={t.slug}>{t.name}{t.language ? <span className="text-xs text-noor-textMuted"> · {t.language}</span> : null}</li>
            ))}
          </ul>
        </div>
      )}

      {block.userData.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          {block.userData.map((u) => (
            <div key={u.label} className="glass-card p-5"><p className="text-xs text-noor-textMuted">{u.label}</p><p className="text-3xl font-display text-noor-goldBright">{u.value}</p></div>
          ))}
        </div>
      )}

      <div className="glass-card p-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">Content cache: {data.cache.keys} items · {data.cache.hits} hits · {data.cache.misses} misses <span className="text-xs text-noor-textMuted">(since the server started)</span></p>
        {me.role === "SUPER_ADMIN"
          ? <button onClick={clear} className="text-xs px-3 py-1 rounded-full border border-noor-border">Clear cache</button>
          : <span className="text-xs text-noor-textMuted">Only a Super Admin can clear the cache</span>}
      </div>
      {msg && <p role="status" className="text-sm text-noor-goldBright">{msg}</p>}
    </div>
  );
}
