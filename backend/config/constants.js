module.exports = {
  ROLES: {
    USER: "USER",
    ADMIN: "ADMIN",
    SUPER_ADMIN: "SUPER_ADMIN",
  },
  CACHE_TTL_SECONDS: {
    QURAN_STATIC: 60 * 60 * 24, // Quran text/metadata rarely changes - cache 24h
    PRAYER_TIMES: 60 * 60, // Prayer times cached per day/location - 1h
  },
};
