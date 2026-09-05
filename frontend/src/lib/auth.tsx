"use client";
import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { apiFetch, clearTokens, setTokens } from "./api";
import { User } from "./types";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    if (!token) {
      setLoading(false);
      return;
    }
    apiFetch("/api/auth/me/")
      .then(async (res) => {
        if (res.ok) {
          const u = (await res.json()) as User;
          if (isMounted) setUser(u);
        } else {
          clearTokens();
          if (isMounted) setUser(null);
        }
      })
      .catch(() => {
        clearTokens();
        if (isMounted) setUser(null);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/auth/login/`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Request-ID": crypto.randomUUID() },
        body: JSON.stringify({ username, password }),
      }
    );
    if (!res.ok) {
      const j = (await res.json()) as { error?: { message?: string } };
      throw new Error(j?.error?.message || "Login failed");
    }
    const data = (await res.json()) as { access: string; refresh: string; user: User };
    setTokens(data.access, data.refresh);
    setUser(data.user);
  }, []);

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
    if (typeof window !== "undefined") {
      window.location.replace("/login");
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
