const NodeCache = require("node-cache");

// Single shared cache instance for the whole backend.
// Used to avoid hammering external Quran/Hadith/Prayer APIs on every request.
// checkperiod controls how often expired keys are swept.
const cache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });

module.exports = cache;
