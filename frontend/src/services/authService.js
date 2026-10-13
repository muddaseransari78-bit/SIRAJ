import api from "./api";

export async function registerRequest({ name, email, password }) {
  const { data } = await api.post("/auth/register", { name, email, password });
  return data.data;
}

export async function loginRequest({ email, password }) {
  const { data } = await api.post("/auth/login", { email, password });
  return data.data;
}

export async function logoutRequest() {
  await api.post("/auth/logout");
}

export async function getMeRequest() {
  const { data } = await api.get("/auth/me");
  return data.data;
}

// Asks for a new access token using the long-lived refresh cookie (the server also renews that cookie).
export async function refreshRequest() {
  const { data } = await api.post("/auth/refresh");
  return data.data;
}
