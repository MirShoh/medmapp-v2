"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, refreshAccess, setTokens, type Tokens } from "./api";

export type User = {
  id: number;
  email: string;
  full_name: string;
  first_name: string;
  last_name: string;
  role: string;
  role_label: string;
  phone: string;
  preferred_language: string;
  hospital: { id: number; name: string; slug: string } | null;
  is_approved: boolean;
  permissions: string[];
  portal: "admin" | "dashboard" | "partner";
};

type Ctx = {
  user: User | null;
  loading: boolean;
  login: (login: string, password: string, portal?: string) => Promise<User>;
  register: (data: Record<string, unknown>) => Promise<User>;
  /** Passwordless sign-in endpoints; returns `need_profile` when a new SMS user must give a name first. */
  signInWith: (path: string, body: Record<string, unknown>) => Promise<{ user?: User; need_profile?: boolean }>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  can: (perm: string) => boolean;
};

const AuthContext = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    // Restore the session from the httpOnly refresh cookie (no tokens are persisted in JS storage).
    const access = await refreshAccess();
    if (!access) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      setUser(await api<User>("/auth/me/"));
    } catch {
      setTokens(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (login: string, password: string, portal?: string) => {
    const res = await api<Tokens & { user: User }>("/auth/login/", { body: { login, password, portal }, auth: false });
    setTokens({ access: res.access });
    setUser(res.user);
    return res.user;
  }, []);

  const register = useCallback(async (data: Record<string, unknown>) => {
    const res = await api<Tokens & { user: User }>("/auth/register/", { body: data, auth: false });
    setTokens({ access: res.access });
    setUser(res.user);
    return res.user;
  }, []);

  const signInWith = useCallback(async (path: string, body: Record<string, unknown>) => {
    const res = await api<Partial<Tokens> & { user?: User; need_profile?: boolean }>(path, { body, auth: false });
    if (res.access && res.user) {
      setTokens({ access: res.access });
      setUser(res.user);
    }
    return res;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api("/auth/logout/", { body: {} });
    } catch {
      /* already invalid */
    }
    setTokens(null);
    setUser(null);
  }, []);

  const can = useCallback(
    (perm: string) => !!user && (user.permissions.includes("*") || user.permissions.includes(perm)),
    [user],
  );

  const value = useMemo(() => ({ user, loading, login, register, signInWith, logout, refresh, can }), [user, loading, login, register, signInWith, logout, refresh, can]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
