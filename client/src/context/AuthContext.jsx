import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../api/client.js';

const AuthContext = createContext(null);
const STORAGE_KEY = 'chatterbox.auth';

// Google sign-in via Yolo-Auth, offered alongside the username and password
// this app has always had. Nobody is signed out and nothing is migrated: the
// server accepts either kind of token and resolves both to the same local
// account, so the shape stored here is unchanged.
const AUTH_URL = (import.meta.env.VITE_AUTH_URL || '').replace(/\/$/, '');

// A ChatterBox token lasts 30 days. A Yolo-Auth access token lasts 15
// minutes, so one has to be renewed and the other does not — without this a
// Google session would stop working mid-conversation, and the first sign that
// anything was wrong would be messages failing to send.
const REFRESH_MARGIN_MS = 60 * 1000;

export function googleSignInAvailable() {
  return Boolean(AUTH_URL);
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);
  // Surfaced on the login screen. A failed Google sign-in otherwise lands
  // back on a login form with no indication anything went wrong.
  const [googleError, setGoogleError] = useState('');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Just back from Yolo-Auth. The fragment carries a 60-second code,
      // traded over POST for the real tokens.
      const hash = new URLSearchParams(window.location.hash.slice(1));
      const code = hash.get('code');
      const failed = hash.get('error');

      if (failed || code) {
        // Clear it before anything else can read it, and so a reload does not
        // try to spend a code that is already gone.
        window.history.replaceState(null, '', window.location.pathname);
      }

      if (failed) {
        if (!cancelled) {
          setGoogleError(decodeURIComponent(failed));
          setLoading(false);
        }
        return;
      }

      if (code) {
        try {
          const response = await fetch(`${AUTH_URL}/auth/exchange`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code }),
          });

          if (!response.ok) {
            const body = await response.json().catch(() => null);
            throw new Error(body?.detail || 'Sign-in could not be completed.');
          }

          const data = await response.json();
          // The local account, which is what every conversation is keyed on.
          const { user } = await api.me(data.access_token);

          if (!cancelled) {
            setAuth({
              token: data.access_token,
              refreshToken: data.refresh_token,
              expiresAt: Date.now() + (data.expires_in || 0) * 1000,
              provider: 'yolo-auth',
              user,
            });
          }
        } catch (error) {
          if (!cancelled) setGoogleError(error.message);
        } finally {
          if (!cancelled) setLoading(false);
        }
        return;
      }

      if (!auth?.token) {
        setLoading(false);
        return;
      }

      // A stored Google session whose short access token died while the tab
      // was closed. Renew it rather than making someone sign in again.
      if (auth.provider === 'yolo-auth' && auth.refreshToken
          && Date.now() > (auth.expiresAt || 0) - REFRESH_MARGIN_MS) {
        try {
          await refreshGoogle(auth.refreshToken);
        } catch {
          if (!cancelled) setAuth(null);
        } finally {
          if (!cancelled) setLoading(false);
        }
        return;
      }

      try {
        const { user } = await api.me(auth.token);
        if (!cancelled) setAuth((prev) => (prev ? { ...prev, user } : prev));
      } catch {
        if (!cancelled) setAuth(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep a Google session alive while the tab is open. A ChatterBox token
  // lasts 30 days and needs none of this; a Yolo-Auth one lasts 15 minutes.
  useEffect(() => {
    if (auth?.provider !== 'yolo-auth' || !auth?.refreshToken) return undefined;

    const due = (auth.expiresAt || 0) - REFRESH_MARGIN_MS - Date.now();
    const timer = setTimeout(
      () => { refreshGoogle(auth.refreshToken).catch(() => setAuth(null)); },
      Math.max(due, 5000)
    );

    return () => clearTimeout(timer);
  }, [auth?.provider, auth?.refreshToken, auth?.expiresAt, refreshGoogle]);

  useEffect(() => {
    if (auth) localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
    else localStorage.removeItem(STORAGE_KEY);
  }, [auth]);

  const login = useCallback(async (username, password) => {
    const data = await api.login({ username, password });
    setAuth(data);
    return data;
  }, []);

  const register = useCallback(async (username, password, displayName) => {
    const data = await api.register({ username, password, displayName });
    setAuth(data);
    return data;
  }, []);

  const updateUser = useCallback((user) => {
    setAuth((prev) => (prev ? { ...prev, user } : prev));
  }, []);

  /** Send the browser to Yolo-Auth. It comes back with a code in the fragment. */
  const signInWithGoogle = useCallback(() => {
    if (!AUTH_URL) return;
    const params = new URLSearchParams({
      redirect_uri: `${window.location.origin}/auth/done`,
      client: 'chatterbox',
    });
    window.location.href = `${AUTH_URL}/auth/google/start?${params}`;
  }, []);

  /**
   * Swap a Yolo-Auth refresh token for a fresh access token.
   *
   * Refresh tokens are single-use and rotate, so the new one must replace the
   * old one in storage or the next refresh fails and the session ends.
   */
  const refreshGoogle = useCallback(async (refreshToken) => {
    const response = await fetch(`${AUTH_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken, client: 'chatterbox' }),
    });

    if (!response.ok) throw new Error('Session expired. Sign in again.');

    const data = await response.json();
    const { user } = await api.me(data.access_token);

    const next = {
      token: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (data.expires_in || 0) * 1000,
      provider: 'yolo-auth',
      user,
    };
    setAuth(next);
    return next;
  }, []);

  const logout = useCallback(() => {
    // Best effort: tell Yolo-Auth to revoke the refresh token so it cannot be
    // reused. Signing out locally happens either way.
    const refreshToken = auth?.refreshToken;
    setAuth(null);

    if (refreshToken && AUTH_URL) {
      fetch(`${AUTH_URL}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      }).catch(() => {});
    }
  }, [auth?.refreshToken]);

  return (
    <AuthContext.Provider
      value={{
        user: auth?.user ?? null,
        token: auth?.token ?? null,
        provider: auth?.provider ?? 'local',
        loading,
        login,
        register,
        logout,
        updateUser,
        signInWithGoogle,
        googleAvailable: Boolean(AUTH_URL),
        googleError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
