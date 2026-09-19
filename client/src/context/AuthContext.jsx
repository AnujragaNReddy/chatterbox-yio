import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../api/client.js';

const AuthContext = createContext(null);
const STORAGE_KEY = 'chatterbox.auth';

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

  useEffect(() => {
    if (!auth?.token) {
      setLoading(false);
      return;
    }
    api
      .me(auth.token)
      .then(({ user }) => setAuth((prev) => (prev ? { ...prev, user } : prev)))
      .catch(() => setAuth(null))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const logout = useCallback(() => setAuth(null), []);

  return (
    <AuthContext.Provider
      value={{ user: auth?.user ?? null, token: auth?.token ?? null, loading, login, register, logout, updateUser }}
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
