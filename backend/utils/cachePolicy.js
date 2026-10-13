// Cache-Control choices (Phase 20 - performance + privacy). Pure function.
//
//  - Anything that carries an Authorization header is private -> "no-store" (never kept by a browser or shared cache).
//  - Public religious content (Quran, Hadith, Tafseer, Duas) read without login can be cached for a while.
//    "stale-while-revalidate" lets the browser show the saved copy instantly and refresh quietly.

function cacheControlFor(req, { maxAge = 0, swr = 0 } = {}) {
  const hasAuth = Boolean(req.headers && req.headers.authorization);
  const isRead = req.method === "GET" || req.method === "HEAD";
  if (!isRead || hasAuth || maxAge <= 0) return "no-store";
  const swrPart = swr > 0 ? `, stale-while-revalidate=${swr}` : "";
  return `public, max-age=${maxAge}${swrPart}`;
}

module.exports = { cacheControlFor };
