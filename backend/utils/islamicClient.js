const axios = require("axios");

function makeIslamicClient(timeout = 10000) {
  const headers = {};
  if (process.env.ISLAMIC_API_KEY) headers["X-Api-Key"] = process.env.ISLAMIC_API_KEY;
  return axios.create({
    baseURL: process.env.ISLAMIC_API_BASE_URL || "https://api.islamic.app",
    timeout,
    headers,
  });
}
module.exports = { makeIslamicClient };