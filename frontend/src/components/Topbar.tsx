"use client";
import { useAuth } from "@/lib/auth";
import { toast } from "@/lib/toast";
import { useEffect, useState, useRef } from "react";

export function Topbar({ title, subtitle }: { title: string; subtitle?: string }) {
  const { user, logout } = useAuth();
  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);
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
            // Slide toaster for every real-time change — assignment is most prominent
            const action = payload.action;
            const refLabel = payload.ref || (payload.work_order_id ? `#${payload.work_order_id.slice(0, 8)}` : "work order");
            if (action === "assigned") {
              // OWNERSHIP: only the assigned technician gets a slide toaster; admin/dispatcher already saw Reassigned success,
              // other technicians are not owners of this work order — no generic assignment toast.
              const me = Boolean(userRef.current && payload.technician_id && userRef.current.id === payload.technician_id);
              if (!me) return;
              // dedup rapid duplicate broadcasts (4x bug) via payload id cache — still needed for technician who may receive same broadcast twice
              const seenKey = `assigned:${payload.work_order_id}:${payload.technician_id}`;
              const seen = (window as unknown as { __seenAssign?: Map<string, number> }).__seenAssign;
              if (!seen) (window as unknown as { __seenAssign?: Map<string, number> }).__seenAssign = new Map();
              const m = (window as unknown as { __seenAssign: Map<string, number> }).__seenAssign;
              const last = m.get(seenKey);
              if (last && Date.now() - last < 6000) return;
              m.set(seenKey, Date.now());

              toast.success(`You have been assigned to ${refLabel} — check My Work`, { title: "New assignment", duration: 6500 });
            } else if (action === "event") {
              // suppress duplicate slide for the actor who just changed status (they already saw "Status updated to X" success)
              const w2 = window as unknown as { __lastStatusAt?: number; __lastStatusWo?: string };
              if (w2.__lastStatusAt && w2.__lastStatusWo === payload.work_order_id && Date.now() - w2.__lastStatusAt < 8000) {
                return;
              }
              const seenE = (window as unknown as { __seenEvent?: Map<string, number> }).__seenEvent;
              if (!seenE) (window as unknown as { __seenEvent?: Map<string, number> }).__seenEvent = new Map();
              const me2 = (window as unknown as { __seenEvent: Map<string, number> }).__seenEvent;
              const k2 = `event:${payload.work_order_id}:${payload.type}:${payload.event_id || ""}`;
              const last2 = me2.get(k2);
              if (last2 && Date.now() - last2 < 6000) return;
              me2.set(k2, Date.now());
              const label = payload.type === "status_changed" ? "Status updated" : payload.type || "Progress event";
              toast.info(`${label} for ${refLabel}`, { title: "Work order updated", duration: 4500 });
            } else if (action === "created") {
              toast.info(`New work order ${refLabel} created`, { title: "Work order created", duration: 5000 });
            } else if (action === "updated") {
              const w3 = window as unknown as { __lastStatusAt?: number; __lastStatusWo?: string };
              if (w3.__lastStatusAt && w3.__lastStatusWo === payload.work_order_id && Date.now() - w3.__lastStatusAt < 8000) return;
              toast.info(`Work order ${refLabel} updated`, { title: "Work order updated", duration: 4500 });
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
