"use client";
import { useEffect, useState, useCallback, Suspense } from "react";
import { apiFetch, apiJson, formatApiError } from "@/lib/api";
import { Topbar } from "@/components/Topbar";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useSearchParams } from "next/navigation";
import { WorkOrder, PaginatedResponse, WorkOrderPriority, WorkOrderStatus } from "@/lib/types";
import { toast } from "@/lib/toast";

function WorkOrdersContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const assignedMe = searchParams.get("assigned") === "me";
  const [q, setQ] = useState("");
  const [statusF, setStatusF] = useState("");
  const [priorityF, setPriorityF] = useState("");
  const [sort, setSort] = useState("-created_at");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PaginatedResponse<WorkOrder> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (q) params.set("search", q);
      if (statusF) params.set("status", statusF);
      if (priorityF) params.set("priority", priorityF);
      if (sort) params.set("sort", sort);
      params.set("page", String(page));
      if (assignedMe && user) params.set("technician", user.id);
      const res = await apiJson<PaginatedResponse<WorkOrder>>(
        `/api/work-orders/?${params.toString()}`
      );
      setData(res);
    } catch (e: unknown) {
      setError(formatApiError(e));
    } finally {
      setLoading(false);
    }
  }, [q, statusF, priorityF, sort, page, assignedMe, user]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  useEffect(() => {
    const handleUpdate = () => {
      fetchList();
    };
    window.addEventListener("work_order_update", handleUpdate);
    return () => window.removeEventListener("work_order_update", handleUpdate);
  }, [fetchList]);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchList();
  };

  const clearFilters = () => {
    setQ("");
    setStatusF("");
    setPriorityF("");
    setSort("-created_at");
    setPage(1);
  };

  const exportCsv = async () => {
    try {
      const params = new URLSearchParams();
      if (q) params.set("search", q);
      if (statusF) params.set("status", statusF);
      if (priorityF) params.set("priority", priorityF);
      if (assignedMe && user) params.set("technician", user.id);
      const res = await apiFetch(`/api/exports/work-orders.csv?${params.toString()}`);
      if (!res.ok) {
        throw new Error("Failed to generate CSV export");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "work_orders.csv";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV export downloaded successfully");
    } catch (e: unknown) {
      toast.error(e, { title: "Export Failed" });
    }
  };

  const title = assignedMe ? "My Work" : "Work Orders";
  const subtitle = assignedMe
    ? `${data?.count ?? 0} assigned to you`
    : `${data?.count ?? 0} work orders`;

  const hasActiveFilter = Boolean(q || statusF || priorityF);

  const prioLabel: Record<string, string> = {
    low: "Low",
    medium: "Medium",
    high: "High",
    urgent: "Urgent",
  };
  const statusLabel: Record<string, string> = {
    draft: "Draft",
    open: "Open",
    scheduled: "Scheduled",
    in_progress: "In Progress",
    blocked: "Blocked",
    completed: "Completed",
    cancelled: "Cancelled",
  };
  const fmtPrio = (v: WorkOrderPriority | string) =>
    prioLabel[v] || v.charAt(0).toUpperCase() + v.slice(1);
  const fmtStatus = (v: WorkOrderStatus | string) =>
    statusLabel[v] ||
    v
      .split("_")
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(" ");

  const fmtDateTime = (iso?: string | null) => {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      return d.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  const prioClass: Record<string, string> = {
    urgent: "bg-red-50 text-red-700 border-red-200",
    high: "bg-orange-50 text-orange-700 border-orange-200",
    medium: "bg-amber-50 text-amber-700 border-amber-200",
    low: "bg-zinc-50 text-zinc-600 border-zinc-200",
  };
  const statusClass: Record<string, string> = {
    open: "bg-zinc-50 text-zinc-700 border-zinc-200",
    scheduled: "bg-blue-50 text-blue-700 border-blue-200",
    in_progress: "bg-amber-50 text-amber-700 border-amber-200",
    completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
    blocked: "bg-red-50 text-red-700 border-red-200",
    draft: "bg-zinc-50 text-zinc-500 border-zinc-200",
    cancelled: "bg-zinc-50 text-zinc-500 border-zinc-200",
  };
  const statusDot: Record<string, string> = {
    open: "bg-zinc-400",
    scheduled: "bg-blue-500",
    in_progress: "bg-amber-500",
    completed: "bg-emerald-500",
    blocked: "bg-red-500",
    draft: "bg-zinc-300",
    cancelled: "bg-zinc-300",
  };

  return (
    <>
      <Topbar title={title} subtitle={subtitle} />
      <div className="p-6 sm:p-8 space-y-4 w-full">
        <div className="rounded-xl bg-white border border-zinc-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-100">
            <div className="flex flex-col lg:flex-row gap-3">
              <form onSubmit={onSearch} className="flex-1 flex gap-2">
                <div className="relative flex-1">
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search"
                    className="w-full h-9 pl-3 pr-3 rounded-lg border border-zinc-200 bg-white focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  className="h-9 px-4 bg-zinc-900 text-white rounded-lg text-sm font-medium hover:bg-zinc-800 transition"
                >
                  Search
                </button>
              </form>
              <div className="flex gap-2">
                <select
                  value={statusF}
                  onChange={(e) => {
                    setStatusF(e.target.value);
                    setPage(1);
                  }}
                  className="h-9 px-3 rounded-lg border border-zinc-200 bg-white text-sm"
                >
                  <option value="">All statuses</option>
                  <option value="open">Open</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="blocked">Blocked</option>
                </select>
                <select
                  value={priorityF}
                  onChange={(e) => {
                    setPriorityF(e.target.value);
                    setPage(1);
                  }}
                  className="h-9 px-3 rounded-lg border border-zinc-200 bg-white text-sm"
                >
                  <option value="">All priorities</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  className="h-9 px-3 rounded-lg border border-zinc-200 bg-white text-sm"
                >
                  <option value="-created_at">Newest</option>
                  <option value="created_at">Oldest</option>
                  <option value="title">Title A–Z</option>
                  <option value="-title">Title Z–A</option>
                </select>
              </div>
            </div>
            {hasActiveFilter && (
              <div className="mt-3 flex items-center gap-2 flex-wrap text-xs">
                <span className="text-zinc-400">Filtered</span>
                {q && (
                  <span className="px-2.5 py-1 rounded-full bg-zinc-900 text-white">
                    “{q}”{" "}
                    <button
                      type="button"
                      onClick={() => setQ("")}
                      className="ml-1 opacity-70 hover:opacity-100"
                    >
                      ×
                    </button>
                  </span>
                )}
                {statusF && (
                  <span
                    className={`px-2.5 py-1 rounded-full border inline-flex items-center gap-1.5 ${
                      statusClass[statusF] || "bg-white border-zinc-200"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        statusDot[statusF] || "bg-zinc-400"
                      }`}
                    />
                    {fmtStatus(statusF)}{" "}
                    <button
                      type="button"
                      onClick={() => setStatusF("")}
                      className="ml-1"
                    >
                      ×
                    </button>
                  </span>
                )}
                {priorityF && (
                  <span
                    className={`px-2.5 py-1 rounded-full border inline-flex items-center gap-1.5 ${
                      prioClass[priorityF] || "bg-white border-zinc-200"
                    }`}
                  >
                    {fmtPrio(priorityF)}{" "}
                    <button
                      type="button"
                      onClick={() => setPriorityF("")}
                      className="ml-1"
                    >
                      ×
                    </button>
                  </span>
                )}
                <button
                  type="button"
                  onClick={clearFilters}
                  className="font-medium text-zinc-600 hover:text-zinc-900 underline underline-offset-4"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          <div className="px-5 py-3 flex items-center justify-between border-b border-zinc-100 bg-zinc-50/50">
            <div className="flex gap-2">
              {user?.role !== "technician" && (
                <Link
                  href="/work-orders/new"
                  className="h-8 px-3.5 bg-zinc-900 text-white rounded-lg text-sm font-medium inline-flex items-center hover:bg-zinc-800"
                >
                  New work order
                </Link>
              )}
              <button
                type="button"
                onClick={exportCsv}
                className="h-8 px-3 border border-zinc-200 bg-white rounded-lg text-sm font-medium hover:bg-zinc-50"
              >
                Export
              </button>
              {assignedMe && (
                <span className="inline-flex items-center h-8 px-3 rounded-lg bg-zinc-900 text-white text-xs font-medium">
                  Technician filtered
                </span>
              )}
            </div>
            <div className="text-xs text-zinc-500 font-light">
              {data
                ? `${(page - 1) * 20 + 1}–${Math.min(page * 20, data.count)} of ${data.count}`
                : ""}
            </div>
          </div>

          {loading ? (
            <div className="px-6 py-16 text-center text-sm text-zinc-500 font-light">
              Loading…
            </div>
          ) : error ? (
            <div className="px-6 py-10 text-center text-sm text-red-600">{error}</div>
          ) : !data || data.results.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="text-sm font-medium">No work orders</div>
              <div className="text-sm text-zinc-500 font-light mt-1">
                {assignedMe ? "No assigned work." : "No matches. Adjust filters."}
              </div>
              {!assignedMe && user?.role !== "technician" && (
                <Link
                  href="/work-orders/new"
                  className="inline-flex mt-4 text-sm font-medium underline underline-offset-4"
                >
                  Create one
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-white text-xs font-medium tracking-widest uppercase text-zinc-400 border-b border-zinc-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Ref</th>
                    <th className="px-4 py-3 text-left font-medium">Title / Site</th>
                    <th className="px-4 py-3 text-left font-medium">Priority</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-left font-medium">Technician</th>
                    <th className="px-4 py-3 text-left font-medium">Scheduled Start</th>
                    <th className="px-4 py-3 text-left font-medium">Scheduled End</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {data.results.map((wo) => (
                    <tr key={wo.id} className="hover:bg-zinc-50/80">
                      <td className="px-4 py-3 font-mono text-xs text-zinc-600">{wo.ref}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium truncate max-w-[220px]">{wo.title}</div>
                        <div className="text-xs text-zinc-500 font-light truncate max-w-[220px]">
                          {wo.site_name}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${
                            prioClass[wo.priority] || "bg-white border-zinc-200"
                          }`}
                        >
                          {fmtPrio(wo.priority)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${
                            statusClass[wo.status] || "bg-white border-zinc-200"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              statusDot[wo.status] || "bg-zinc-300"
                            }`}
                          />
                          {fmtStatus(wo.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-600">
                        {wo.technician?.username || (
                          <span className="text-zinc-400 font-light">Unassigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-600 font-light whitespace-nowrap">
                        {fmtDateTime(wo.scheduled_start)}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-600 font-light whitespace-nowrap">
                        {fmtDateTime(wo.scheduled_end)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/work-orders/${wo.id}`}
                          className="text-xs font-medium underline underline-offset-4 hover:text-zinc-900"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data && data.count > 20 && (
            <div className="px-5 py-4 border-t border-zinc-100 flex items-center justify-between">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="h-8 px-3 rounded-lg border border-zinc-200 bg-white text-sm font-medium disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-sm text-zinc-600 font-light">
                Page {page} of {Math.ceil(data.count / 20)}
              </span>
              <button
                type="button"
                disabled={!!data && page >= Math.ceil(data.count / 20)}
                onClick={() => setPage((p) => p + 1)}
                className="h-8 px-3 rounded-lg border border-zinc-200 bg-white text-sm font-medium disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function WorkOrdersPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-zinc-500">Loading work orders...</div>
      }
    >
      <WorkOrdersContent />
    </Suspense>
  );
}
