const { cacheControlFor } = require("../utils/cachePolicy");

// Default for the whole API: never cache. Private data must not sit in a browser/proxy cache.
function noStore(req, res, next) {
  res.set("Cache-Control", "no-store");
  next();
}

// For public content routes: router.use("/quran", publicCache(3600), quranRoutes) caches GET requests made without login.
// "Vary: Authorization" makes sure a logged-in answer is never mixed with a guest answer.
// skipPaths: paths that change every day (like "/today") and must NOT be cached for long.
function publicCache(maxAge, { skipPaths = [] } = {}) {
  const swr = Math.round(maxAge / 2);
  return (req, res, next) => {
    if (skipPaths.includes(req.path)) return next();
    res.set("Cache-Control", cacheControlFor(req, { maxAge, swr }));
    res.vary("Authorization");
    next();
  };
}

module.exports = { noStore, publicCache };
