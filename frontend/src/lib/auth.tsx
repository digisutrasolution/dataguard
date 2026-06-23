import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, setAuthToken, type AuthUser } from './api';

interface AuthState {
  user: AuthUser | null;
  ready: boolean;
  loginWithToken: (token: string, user: AuthUser) => void;
  logout: () => void;
  refresh: () => void;
}

const Ctx = createContext<AuthState>(null!);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  // Restore a saved session on load.
  useEffect(() => {
    if (localStorage.getItem('dg_token')) {
      api.auth.me().then(setUser).catch(() => setAuthToken(null)).finally(() => setReady(true));
    } else {
      setReady(true);
    }
  }, []);

  const loginWithToken = (token: string, u: AuthUser) => {
    setAuthToken(token);
    setUser(u);
  };
  const logout = () => {
    setAuthToken(null);
    setUser(null);
  };
  const refresh = () => api.auth.me().then(setUser).catch(() => {});

  return <Ctx.Provider value={{ user, ready, loginWithToken, logout, refresh }}>{children}</Ctx.Provider>;
}
