import React, { createContext, useContext, useEffect, useState } from "react";
import { loginRequest, registerRequest, logoutRequest, getMeRequest, refreshRequest } from "../services/authService";

const AuthContext = createContext(null);
const TOKEN_KEY = "siraj_access_token";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Once logged in, always logged in: when the person comes back (even days later, after the 15-minute access
    // token ran out or the browser storage was cleared) the long-lived refresh cookie logs them in again.
    let alive = true;
    (async () => {
      try {
        if (!localStorage.getItem(TOKEN_KEY)) {
          const data = await refreshRequest(); // 401 here simply means "never logged in on this browser"
          localStorage.setItem(TOKEN_KEY, data.accessToken);
        }
        const data = await getMeRequest(); // an old token is renewed by the api layer if needed
        if (alive) setUser(data.user);
      } catch (err) {
        // Only a real "you are not logged in" answer ends the session. A bad connection must NOT log the person out.
        const status = err && err.response && err.response.status;
        if (status === 401 || status === 403) localStorage.removeItem(TOKEN_KEY);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  async function login(credentials) {
    const data = await loginRequest(credentials);
    localStorage.setItem(TOKEN_KEY, data.accessToken);
    setUser(data.user);
    return data.user;
  }

  async function register(details) {
    const data = await registerRequest(details);
    localStorage.setItem(TOKEN_KEY, data.accessToken);
    setUser(data.user);
    return data.user;
  }

  // Used by the Google / Apple sign-in: the server already answered with { user, accessToken }
  function applySession(data) {
    localStorage.setItem(TOKEN_KEY, data.accessToken);
    setUser(data.user);
    return data.user;
  }

  async function logout() {
    try { await logoutRequest(); } catch (e) { /* even if the server cannot be reached, log out here */ }
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }

  // Lets pages (e.g. Profile) update the name shown in the navbar after saving
  function updateUser(patch) {
    setUser((u) => (u ? { ...u, ...patch } : u));
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, applySession, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
