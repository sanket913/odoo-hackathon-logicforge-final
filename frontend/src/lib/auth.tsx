import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, session } from "@/lib/api";

export type AppUser = { id?: string; name?: string; email?: string; role?: string; photo?: string };
type AuthContextValue = {
  user: AppUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: Record<string, unknown>) => Promise<boolean>;
  logout: () => Promise<void>;
  setUser: (user: AppUser | null) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(() => session.getUser<AppUser>());
  const [loading, setLoading] = useState(Boolean(session.getToken()));

  useEffect(() => {
    if (!session.getToken()) { setLoading(false); return; }
    api.auth.me().then((next) => {
      const current = next as AppUser;
      const token = session.getToken();
      if (token) session.set(token, current);
      setUser(current);
    }).catch(() => { session.clear(); setUser(null); }).finally(() => setLoading(false));
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user, loading, setUser,
    login: async (email, password) => {
      const result = await api.auth.login({ email, password });
      session.set(result.token, result.user);
      setUser(result.user as AppUser);
    },
    register: async (data) => {
      const result = await api.auth.register(data);
      if (result.token && result.user) { session.set(result.token, result.user); setUser(result.user as AppUser); return true; }
      return false;
    },
    logout: async () => {
      try { await api.auth.logout(); } catch { /* local sign-out remains available offline */ }
      session.clear(); setUser(null);
    },
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
