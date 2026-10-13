import axios from "axios";

// VITE_API_BASE_URL is baked in when the site is BUILT (Vercel / Netlify -> Environment variables). The localhost fallback is for
// development only: in a real build a missing value is announced loudly instead of failing silently for every visitor.
const API_BASE = (import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? "http://localhost:5000/api" : "")).replace(/\/+$/, "");
if (!API_BASE) console.error("[SIRAJ] VITE_API_BASE_URL was not set when this site was built, so the server cannot be reached. Set it to https://YOUR-BACKEND/api and redeploy.");

const api = axios.create({
  baseURL: API_BASE || "/api",
  withCredentials: true, // sends the httpOnly refresh token cookie
});

// Attach the access token to every outgoing request, if we have one.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("siraj_access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// If a request fails with 401, silently get a new access token ONCE and repeat the request.
// Several requests can fail at the same moment (a page loads many things): they all wait for the same single refresh,
// instead of the later ones failing (that used to log people out at random).
let refreshing = null;
function refreshAccessToken() {
  if (!refreshing) {
    refreshing = axios
      .post(`${api.defaults.baseURL}/auth/refresh`, null, { withCredentials: true })
      .then((res) => {
        const token = res.data.data.accessToken;
        localStorage.setItem("siraj_access_token", token);
        return token;
      })
      .finally(() => { refreshing = null; });
  }
  return refreshing;
}

// These never trigger a refresh: wrong password is just a wrong password, and refresh itself cannot refresh itself.
const NO_REFRESH = /\/auth\/(login|register|google|apple|refresh|logout)$/;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response && error.response.status;

    if (status === 401 && originalRequest && !originalRequest._retry && !NO_REFRESH.test(originalRequest.url || "")) {
      originalRequest._retry = true;
      try {
        const token = await refreshAccessToken();
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Only a real 401 / 403 from the refresh call means the long login is over. A network hiccup keeps the session.
        const rs = refreshError && refreshError.response && refreshError.response.status;
        if (rs === 401 || rs === 403) localStorage.removeItem("siraj_access_token");
      }
    }

    return Promise.reject(error);
  }
);

export default api;
