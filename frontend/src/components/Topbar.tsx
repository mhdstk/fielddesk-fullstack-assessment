"use client";
import { useAuth } from "@/lib/auth";
import { toast } from "@/lib/toast";
import { useEffect, useState, useRef } from "react";

export function Topbar({ title, subtitle }: { title: string; subtitle?: string }) {
  const { user, logout } = useAuth();
  const [live, setLive] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let retries = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
      if (!token) {
        setLive("disconnected");
        return;
      }
      setLive("connecting");
      const proto = window.location.protocol === "https:" ? "wss" : "ws";
      const base = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(
        /^https?:\/\//,
        ""
      );
      ws = new WebSocket(`${proto}://${base}/ws/work-orders/?token=${token}`);
      ws.onopen = () => {
        retries = 0;
        setLive("connected");
      };
      ws.onclose = () => {
        setLive("disconnected");
        if (retries < 5) {
          const delay = Math.min(1000 * Math.pow(2, retries), 15000);
          retries += 1;
          timer = setTimeout(connect, delay);
        }
      };
      ws.onerror = () => {
        ws?.close();
      };
      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data) as { type?: string; data?: { action?: string; work_order_id?: string; ref?: string; technician_id?: string; type?: string; event_id?: string } };
          if (data.type === "work_order_update") {
            const payload = data.data || {};
            window.dispatchEvent(new CustomEvent("work_order_update", { detail: payload }));
            // Toaster notifications for all real-time work order changes
            const action = payload.action;
            if (action === "assigned") {
              toast.info(`Technician assigned to work order ${payload.ref || payload.work_order_id || ""}`.trim(), { title: "Assignment" });
            } else if (action === "event") {
              const label = payload.type === "status_changed" ? "Status updated" : payload.type || "Progress event";
              toast.info(`${label} for ${payload.work_order_id?.slice(0, 8) || "work order"}`, { title: "Work order updated" });
            } else if (action === "created") {
              toast.info(`New work order ${payload.ref || ""} created`, { title: "Work order created" });
            } else if (action === "updated") {
              toast.info(`Work order ${payload.ref || payload.work_order_id?.slice(0, 8) || ""} updated`, { title: "Work order updated" });
            }
          }
        } catch {
          // Ignore parse errors on malformed messages
        }
      };
    };

    connect();

    return () => {
      if (timer) clearTimeout(timer);
      ws?.close();
    };
  }, []);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  return (
    <div className="h-[64px] bg-white border-b border-zinc-200 px-5 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-30">
      <div className="min-w-0">
        <h1 className="text-base font-semibold text-zinc-900 leading-none tracking-tight truncate">
          {title}
        </h1>
        {subtitle && <p className="text-sm text-zinc-500 mt-1 truncate font-light">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
            live === "connected"
              ? "bg-zinc-900 text-white border-zinc-900"
              : live === "connecting"
              ? "bg-amber-50 text-amber-700 border-amber-200"
              : "bg-zinc-50 text-zinc-500 border-zinc-200"
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              live === "connected"
                ? "bg-white animate-pulse"
                : live === "connecting"
                ? "bg-amber-500"
                : "bg-zinc-400"
            }`}
          />{" "}
          {live}
        </span>
        {user && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full border border-zinc-200 bg-white hover:bg-zinc-50 transition-colors"
            >
              <span className="w-7 h-7 rounded-full bg-zinc-900 text-white flex items-center justify-center text-xs font-medium">
                {user.username.slice(0, 2).toUpperCase()}
              </span>
              <span className="hidden sm:block text-sm font-medium text-zinc-700 max-w-[14ch] truncate">
                {user.username}
              </span>
              <span className="hidden sm:block text-xs text-zinc-400 capitalize">{user.role}</span>
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-[calc(100%+8px)] w-[260px] rounded-xl border border-zinc-200 bg-white shadow-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-100">
                  <div className="text-sm font-medium truncate">{user.username}</div>
                  <div className="text-xs text-zinc-500 truncate font-light">{user.email}</div>
                  <div className="mt-2 text-xs">
                    <span className="font-medium capitalize">{user.role}</span>
                    <span className="text-zinc-400"> • </span>
                    <span className="text-zinc-500 font-light">{user.organisation.name}</span>
                  </div>
                </div>
                <div className="p-2">
                  <button
                    onClick={logout}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-zinc-700 hover:bg-zinc-50 text-left"
                  >
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
