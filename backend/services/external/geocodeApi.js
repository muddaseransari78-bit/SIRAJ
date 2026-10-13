const axios = require("axios");
const cache = require("../../utils/cache");

// Open-Meteo geocoding: free, no API key. Turns a city name into coordinates.
const BASE_URL = process.env.GEOCODE_API_BASE_URL || "https://geocoding-api.open-meteo.com/v1";
const client = axios.create({ baseURL: BASE_URL, timeout: 8000 });

async function searchPlaces(query) {
  const q = String(query).trim().toLowerCase();
  const key = `geo:${q}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const response = await client.get("/search", { params: { name: q, count: 6, language: "en", format: "json" } });
  const results = (response.data.results || []).map((r) => ({
    name: r.name,
    region: r.admin1 || "",
    country: r.country || "",
    lat: r.latitude,
    lng: r.longitude,
  }));
  cache.set(key, results, 60 * 60 * 24);
  return results;
}

module.exports = { searchPlaces };
