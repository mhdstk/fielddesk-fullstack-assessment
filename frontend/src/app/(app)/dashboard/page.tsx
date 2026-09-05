"use client";
import { useEffect, useState, useCallback } from "react";
import { apiJson } from "@/lib/api";
import { Topbar } from "@/components/Topbar";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { Stats, WorkOrder, PaginatedResponse } from "@/lib/types";

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<WorkOrder[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const s = await apiJson<Stats>("/api/work-orders/stats/");
      setStats(s);
      const r = await apiJson<PaginatedResponse<WorkOrder>>("/api/work-orders/?page_size=5");
      setRecent(r.results || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard");
    }
  }, []);

  useEffect(() => {
    load();
    const h = () => {
      load();
    };
    window.addEventListener("work_order_update", h);
    return () => window.removeEventListener("work_order_update", h);
  }, [load]);

  if (error)
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 p-4 text-sm">
          {error}
        </div>
      </div>
    );

  if (!stats)
    return (
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-28 rounded-xl bg-white border border-zinc-200 animate-pulse"
            />
          ))}
        </div>
      </div>
    );

  const statusOrder = [
    "draft",
    "open",
    "scheduled",
    "in_progress",
    "blocked",
    "completed",
    "cancelled",
  ];
  const statusLabel: Record<string, string> = {
    draft: "Draft",
    open: "Open",
    scheduled: "Scheduled",
    in_progress: "In Progress",
    blocked: "Blocked",
    completed: "Completed",
    cancelled: "Cancelled",
  };
  const prioLabel: Record<string, string> = {
    low: "Low",
    medium: "Medium",
    high: "High",
    urgent: "Urgent",
  };
  const fmtStatus = (s: string) =>
    statusLabel[s] ||
    s
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  const fmtPrio = (s: string) => prioLabel[s] || s.charAt(0).toUpperCase() + s.slice(1);
  const isTech = user?.role === "technician";

  return (
    <>
      <Topbar
        title={isTech ? `Welcome, ${user?.username}` : "Overview"}
        subtitle={isTech ? "Your assigned work" : `${user?.organisation.name} • Live data`}
      />
      <div className="p-6 sm:p-8 space-y-8 w-full">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">
            {isTech ? `${stats.my_assigned ?? 0} assigned` : `${stats.total} work orders`}
          </h2>
          <p className="text-sm text-zinc-500 font-light">
            {isTech
              ? "Only work assigned to you — enforced on the server."
              : "All work orders for your organisation. Data is live and isolated."}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: isTech ? "My assigned" : "Total",
              value: isTech ? stats.my_assigned ?? 0 : stats.total,
              note: isTech ? "Visible to you" : "All statuses",
            },
            ...Object.entries(stats.by_status)
              .slice(0, 3)
              .map(([k, v]) => ({
                label: fmtStatus(k),
                value: v,
                note: `${Math.round((v / (stats.total || 1)) * 100)}%`,
              })),
          ].map((card, i) => (
            <div key={i} className="rounded-xl bg-white border border-zinc-200 p-5">
              <div className="text-xs font-medium tracking-widest uppercase text-zinc-400">
                {card.label}
              </div>
              <div className="text-2xl font-semibold mt-2 tracking-tight">{card.value}</div>
              <div className="text-xs text-zinc-500 mt-1 font-light">{card.note}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-xl bg-white border border-zinc-200">
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="font-medium text-sm">By status</h3>
              <Link
                href="/work-orders"
                className="text-xs font-medium text-zinc-600 hover:text-zinc-900 underline underline-offset-4"
              >
                View all
              </Link>
            </div>
            <div className="p-6 space-y-4">
              {statusOrder.map((s) => {
                const v = stats.by_status[s] || 0;
                const pct = stats.total ? Math.round((v / stats.total) * 100) : 0;
                return (
                  <div key={s} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-zinc-700">{fmtStatus(s)}</span>
                      <span className="text-xs font-medium text-zinc-900">
                        {v} <span className="text-zinc-400 font-light">• {pct}%</span>
                      </span>
                    </div>
                    <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-zinc-900 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="rounded-xl bg-white border border-zinc-200">
            <div className="px-6 py-4 border-b border-zinc-100">
              <h3 className="font-medium text-sm">By priority</h3>
            </div>
            <div className="p-2">
              {Object.entries(stats.by_priority)
                .sort(
                  (a, b) =>
                    ({
                      urgent: 4,
                      high: 3,
                      medium: 2,
                      low: 1,
                    }[b[0]] || 0) -
                    ({
                      urgent: 4,
                      high: 3,
                      medium: 2,
                      low: 1,
                    }[a[0]] || 0)
                )
                .map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between py-3 px-4">
                    <span className="text-sm text-zinc-700">{fmtPrio(k)}</span>
                    <span className="text-sm font-semibold">{v}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-white border border-zinc-200">
          <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
            <h3 className="font-medium text-sm">Recent work orders</h3>
          </div>
          <div className="divide-y divide-zinc-100">
            {recent.map((wo) => (
              <Link
                key={wo.id}
                href={`/work-orders/${wo.id}`}
                className="flex items-center justify-between px-6 py-4 hover:bg-zinc-50 transition-colors group"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-zinc-500">{wo.ref}</span>
                    <span className="font-medium text-sm truncate group-hover:text-zinc-900">
                      {wo.title}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-500 mt-1 truncate font-light">
                    {wo.site_name} • {fmtPrio(wo.priority)}
                  </div>
                </div>
                <span className="shrink-0 ml-4 text-xs font-medium px-2.5 py-1 rounded-full border border-zinc-200 bg-white">
                  {fmtStatus(wo.status)}
                </span>
              </Link>
            ))}
            {recent.length === 0 && (
              <div className="px-6 py-10 text-center text-sm text-zinc-500 font-light">
                No work orders yet
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
