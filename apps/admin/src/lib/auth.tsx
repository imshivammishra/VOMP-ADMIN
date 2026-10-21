"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { User } from "@/lib/types";

interface AuthValue {
  user: User | null;
  loading: boolean;
  refresh: () => Promise<User | null>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const refresh = useCallback(async () => {
    try {
      const result = await api<{ user: User }>("/api/admin/auth/me", { skipAuthRedirect: true });
      setUser(result.user);
      return result.user;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const current = await refresh();
      if (!active) return;
      setLoading(false);
      if (!current && pathname !== "/login") router.replace("/login");
      if (current && pathname === "/login") router.replace("/");
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onUnauthorized = () => {
      setUser(null);
      setLoading(false);
      if (pathname !== "/login") router.replace("/login");
    };
    window.addEventListener("vomp:unauthorized", onUnauthorized);
    return () => window.removeEventListener("vomp:unauthorized", onUnauthorized);
  }, [pathname, router]);

  const login = useCallback(
    async (email: string, password: string) => {
      setLoading(true);
      try {
        const result = await api<{ user: User }>("/api/admin/auth/login", {
          method: "POST",
          body: { email, password },
          skipAuthRedirect: true,
        });
        setUser(result.user);
        router.replace("/");
      } finally {
        setLoading(false);
      }
    },
    [router]
  );

  const logout = useCallback(async () => {
    try {
      await api("/api/admin/auth/logout", { method: "POST", skipAuthRedirect: true });
    } finally {
      setUser(null);
      router.replace("/login");
    }
  }, [router]);

  const value = useMemo(() => ({ user, loading, refresh, login, logout }), [user, loading, refresh, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
