import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { AuthAPI, tokenStore, type AuthUser, type Vehicle } from "./api";

type AuthCtx = {
  user: AuthUser | null;
  loading: boolean;
  isAuthed: boolean;
  isOwner: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (d: { name: string; email: string; password: string; role?: string; vehicle?: Vehicle }) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setUser: (u: AuthUser | null) => void;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!tokenStore.get()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const r = await AuthAPI.profile();
      const u = r.data?.data;
      if (u) setUser({ ...u, id: u._id ?? u.id });
      else setUser(null);
    } catch {
      tokenStore.clear();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login: AuthCtx["login"] = async (email, password) => {
    const r = await AuthAPI.login({ email, password });
    const data = r.data;
    if (data.token) tokenStore.set(data.token);
    const u = { ...data.data, id: data.data._id ?? data.data.id };
    setUser(u);
    return u;
  };

  const register: AuthCtx["register"] = async (d) => {
    const r = await AuthAPI.register(d);
    const data = r.data;
    if (data.token) tokenStore.set(data.token);
    const u = { ...data.data, id: data.data._id ?? data.data.id };
    setUser(u);
    return u;
  };

  const logout = async () => {
    try { await AuthAPI.logout(); } catch { /* ignore */ }
    tokenStore.clear();
    setUser(null);
  };

  return (
    <Ctx.Provider
      value={{
        user,
        loading,
        isAuthed: !!user,
        isOwner: user?.role === "StationOwner" || user?.role === "admin",
        login,
        register,
        logout,
        refresh,
        setUser,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used within AuthProvider");
  return c;
}
