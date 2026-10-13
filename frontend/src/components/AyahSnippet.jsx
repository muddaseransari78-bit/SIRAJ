import React from "react";
import { splitHighlight, stripTags } from "../utils/searchHighlight";
import { pickAyahLayers } from "../utils/ayahLayers";

// An Ayah found by a search / topic / Source Finder, shown in the reader's own language:
//   English mode -> the English translation (or the Arabic / Urdu text that matched what was typed)
//   Urdu mode    -> Arabic + Urdu translation
//   Arabic mode  -> Arabic
// The text itself is never changed; `query` only marks the words that were searched.
function Marked({ text, query }) {
  if (!query) return <>{stripTags(text)}</>;
  return (
    <>
      {splitHighlight(stripTags(text), query).map((p, i) =>
        p.hit ? <mark key={i} className="bg-noor-gold/25 text-noor-goldBright rounded px-0.5">{p.text}</mark> : <span key={i}>{p.text}</span>
      )}
    </>
  );
}

export default function AyahSnippet({ r, lang, query }) {
  const layers = pickAyahLayers(r, lang);
  return (
    <div className="space-y-1 mt-1">
      {layers.map((l) => {
        const marked = l.marked ? query : "";
        if (l.kind === "arabic") {
          return <p key="ar" dir="rtl" lang="ar" className="font-arabic text-xl leading-loose text-right"><Marked text={l.text} query={marked} /></p>;
        }
        if (l.kind === "urdu") {
          return <p key="ur" dir="rtl" lang="ur" className="font-urdu text-noor-textMuted text-lg leading-loose text-right"><Marked text={l.text} query={marked} /></p>;
        }
        return <p key="en" dir="ltr" lang="en" className="text-noor-textMuted text-sm"><Marked text={l.text} query={marked} /></p>;
      })}
    </div>
  );
}
