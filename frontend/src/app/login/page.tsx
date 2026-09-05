"use client";
import React, { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { formatApiError } from "@/lib/api";
import { toast } from "@/lib/toast";

const SAMPLE = [
  { label: "Acme — Owner", username: "acme_owner", org: "Acme" },
  { label: "Acme — Dispatcher", username: "acme_dispatcher", org: "Acme" },
  { label: "Acme — Technician", username: "acme_technician", org: "Acme" },
  { label: "Globex — Owner", username: "globex_owner", org: "Globex" },
  { label: "Globex — Dispatcher", username: "globex_dispatcher", org: "Globex" },
  { label: "Globex — Technician", username: "globex_technician", org: "Globex" },
];

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("acme_owner");
  const [password, setPassword] = useState("Password123!");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
      toast.success("Signed in successfully");
      router.push("/dashboard");
    } catch (err: unknown) {
      const msg = formatApiError(err);
      setError(msg);
      toast.error(err, { title: "Login Failed" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fcfcfc] flex items-center justify-center p-6">
      <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-8 items-center">
        <div className="hidden lg:block pr-8">
          <div className="w-10 h-10 rounded-xl bg-zinc-900 flex items-center justify-center text-white font-semibold text-sm">
            FD
          </div>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight leading-tight">
            Field operations,
            <br />
            <span className="font-light text-zinc-500">without the noise.</span>
          </h1>
          <p className="mt-3 text-sm text-zinc-500 font-light leading-relaxed max-w-md">
            Minimal, isolated, auditable. Two organisations, three roles, real-time — all with clear
            boundaries.
          </p>
          <div className="mt-8 space-y-3 text-sm">
            <div className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-zinc-900 text-white flex items-center justify-center text-xs">
                1
              </span>
              <span className="text-zinc-700">Tenant isolation at the DB layer</span>
            </div>
            <div className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-zinc-900 text-white flex items-center justify-center text-xs">
                2
              </span>
              <span className="text-zinc-700">Immutable audit log</span>
            </div>
            <div className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-zinc-900 text-white flex items-center justify-center text-xs">
                3
              </span>
              <span className="text-zinc-700">Real-time per organisation</span>
            </div>
          </div>
          <div className="mt-10 text-xs text-zinc-400 font-light">
            © 2026 FieldDesk • Multi-tenant Field Service Platform
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-2xl p-6 sm:p-8 shadow-sm">
          <div className="lg:hidden flex items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-xl bg-zinc-900 flex items-center justify-center text-white font-semibold text-sm">
              FD
            </div>
            <div>
              <div className="font-semibold text-sm">FieldDesk</div>
              <div className="text-xs text-zinc-500 font-light">Field Service</div>
            </div>
          </div>
          <h2 className="text-xl font-semibold tracking-tight">Sign in</h2>
          <p className="text-sm text-zinc-500 font-light mt-1">
            Use a sample account. Password is{" "}
            <span className="font-medium text-zinc-700">Password123!</span>
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="text-sm font-medium text-zinc-700">Username</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1.5 w-full h-10 px-3 rounded-lg border border-zinc-200 bg-white text-sm focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
                placeholder="acme_owner"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-zinc-700">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 w-full h-10 px-3 rounded-lg border border-zinc-200 bg-white text-sm focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
                placeholder="••••••••"
              />
            </div>
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm px-3 py-2.5">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-60 text-white rounded-lg font-medium text-sm transition-colors"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-zinc-100">
            <p className="text-xs font-medium tracking-widest uppercase text-zinc-400 mb-3">
              Sample accounts
            </p>
            <div className="grid grid-cols-2 gap-2">
              {SAMPLE.map((s) => (
                <button
                  key={s.username}
                  type="button"
                  onClick={() => {
                    setUsername(s.username);
                    setPassword("Password123!");
                  }}
                  className={`text-left px-3 py-2.5 rounded-xl border text-sm transition-colors ${
                    username === s.username
                      ? "bg-zinc-900 text-white border-zinc-900"
                      : "bg-white border-zinc-200 hover:bg-zinc-50 text-zinc-700"
                  }`}
                >
                  <div className="font-medium text-xs">{s.label}</div>
                  <div className="text-xs font-light opacity-70">{s.username}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
