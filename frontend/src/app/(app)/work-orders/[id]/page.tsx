"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch, apiJson, formatApiError } from "@/lib/api";
import { Topbar } from "@/components/Topbar";
import { useAuth } from "@/lib/auth";
import { toast } from "@/lib/toast";
import {
  WorkOrder,
  AuditLog,
  User,
  PaginatedResponse,
  WorkOrderStatus,
} from "@/lib/types";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  open: "Open",
  scheduled: "Scheduled",
  in_progress: "In Progress",
  blocked: "Blocked",
  completed: "Completed",
  cancelled: "Cancelled",
};
const PRIORITY_LABEL: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};
const FIELD_LABEL: Record<string, string> = {
  technician_id: "Technician",
  scheduled_start: "Scheduled Start",
  scheduled_end: "Scheduled End",
  status: "Status",
  title: "Title",
  priority: "Priority",
  site_name: "Site Name",
  description: "Description",
  attachment_id: "Attachment",
};

function formatStatus(v?: string | null) {
  return v
    ? STATUS_LABEL[v] ||
        v
          .split("_")
          .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
          .join(" ")
    : "—";
}
function formatPriority(v?: string | null) {
  return v ? PRIORITY_LABEL[v] || v.charAt(0).toUpperCase() + v.slice(1) : "—";
}
function formatField(k: string) {
  return (
    FIELD_LABEL[k] ||
    k
      .split("_")
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(" ")
  );
}

const STATUS_PILL: Record<string, string> = {
  open: "bg-zinc-50 text-zinc-700 border-zinc-200",
  scheduled: "bg-blue-50 text-blue-700 border-blue-200",
  in_progress: "bg-amber-50 text-amber-700 border-amber-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  blocked: "bg-red-50 text-red-700 border-red-200",
  draft: "bg-zinc-50 text-zinc-500 border-zinc-200",
  cancelled: "bg-zinc-50 text-zinc-500 border-zinc-200",
};
const STATUS_DOT: Record<string, string> = {
  open: "bg-zinc-400",
  scheduled: "bg-blue-500",
  in_progress: "bg-amber-500",
  completed: "bg-emerald-500",
  blocked: "bg-red-500",
  draft: "bg-zinc-300",
  cancelled: "bg-zinc-300",
};
const PRIORITY_PILL: Record<string, string> = {
  low: "bg-zinc-50 text-zinc-600 border-zinc-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  high: "bg-orange-50 text-orange-700 border-orange-200",
  urgent: "bg-red-50 text-red-700 border-red-200",
};

function getActionMeta(action: string) {
  const a = action.toLowerCase();
  if (a.includes("created"))
    return {
      label: "Created",
      desc: "created the work order",
      dot: "bg-emerald-500",
      ring: "border-emerald-200",
      badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    };
  if (a.includes("assignment") || a.includes("assigned"))
    return {
      label: "Assignment",
      desc: "changed assignment",
      dot: "bg-blue-500",
      ring: "border-blue-200",
      badge: "bg-blue-50 text-blue-700 border-blue-200",
    };
  if (a.includes("status"))
    return {
      label: "Status Update",
      desc: "changed status",
      dot: "bg-amber-500",
      ring: "border-amber-200",
      badge: "bg-amber-50 text-amber-700 border-amber-200",
    };
  if (a.includes("attachment"))
    return {
      label: "Attachment",
      desc: "added an attachment",
      dot: "bg-violet-500",
      ring: "border-violet-200",
      badge: "bg-violet-50 text-violet-700 border-violet-200",
    };
  if (a.includes("notification"))
    return {
      label: "Notification",
      desc: "notification",
      dot: "bg-sky-500",
      ring: "border-sky-200",
      badge: "bg-sky-50 text-sky-700 border-sky-200",
    };
  if (a.includes("event"))
    return {
      label: "Event",
      desc: "recorded an event",
      dot: "bg-zinc-900",
      ring: "border-zinc-200",
      badge: "bg-white text-zinc-700 border-zinc-200",
    };
  return {
    label: formatField(action),
    desc: formatField(action),
    dot: "bg-zinc-400",
    ring: "border-zinc-200",
    badge: "bg-white text-zinc-700 border-zinc-200",
  };
}

function DiffBlock({
  before,
  after,
}: {
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}) {
  if (!before && !after) return null;
  const beforeStatus = before?.status as string | undefined;
  const afterStatus = after?.status as string | undefined;
  const hasStatus = beforeStatus || afterStatus;
  const beforePriority = before?.priority as string | undefined;
  const afterPriority = after?.priority as string | undefined;
  const hasPriority = beforePriority || afterPriority;
  const hasTech = before?.technician_id !== undefined || after?.technician_id !== undefined;
  const hasAttach = after?.attachment_id;

  if (hasStatus) {
    return (
      <div className="mt-3">
        <div className="text-xs font-medium text-zinc-500 mb-1">{formatField("status")}</div>
        <div className="flex items-center gap-2 text-xs">
          <span
            className={`px-2.5 py-1 rounded-full border inline-flex items-center gap-1.5 ${
              STATUS_PILL[beforeStatus || ""] || "bg-white border-zinc-200"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                STATUS_DOT[beforeStatus || ""] || "bg-zinc-300"
              }`}
            />
            {formatStatus(beforeStatus)}
          </span>
          <span className="text-zinc-400">→</span>
          <span
            className={`px-2.5 py-1 rounded-full border inline-flex items-center gap-1.5 ${
              STATUS_PILL[afterStatus || ""] || "bg-zinc-900 text-white border-zinc-900"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                STATUS_DOT[afterStatus || ""] || "bg-white"
              }`}
            />
            {formatStatus(afterStatus)}
          </span>
          {Boolean(after?.event_id) && (
            <span className="ml-2 font-mono text-xs text-zinc-500">
              #{String(after?.event_id).slice(0, 8)}
            </span>
          )}
        </div>
      </div>
    );
  }
  if (hasPriority) {
    return (
      <div className="mt-3">
        <div className="text-xs font-medium text-zinc-500 mb-1">{formatField("priority")}</div>
        <div className="flex items-center gap-2 text-xs">
          <span
            className={`px-2.5 py-1 rounded-full border ${
              PRIORITY_PILL[beforePriority || ""] || "bg-white border-zinc-200"
            }`}
          >
            {formatPriority(beforePriority)}
          </span>
          <span className="text-zinc-400">→</span>
          <span
            className={`px-2.5 py-1 rounded-full border ${
              PRIORITY_PILL[afterPriority || ""] || "bg-zinc-900 text-white border-zinc-900"
            }`}
          >
            {formatPriority(afterPriority)}
          </span>
        </div>
      </div>
    );
  }
  if (hasTech) {
    return (
      <div className="mt-3">
        <div className="text-xs font-medium text-zinc-500 mb-1">
          {formatField("technician_id")}
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="px-2.5 py-1 rounded-full bg-white border border-zinc-200 truncate max-w-[18ch]">
            {before?.technician_id ? "Assigned" : "Unassigned"}
          </span>
          <span className="text-zinc-400">→</span>
          <span className="px-2.5 py-1 rounded-full bg-zinc-900 text-white truncate max-w-[18ch]">
            {after?.technician_id ? "Assigned" : "Unassigned"}
          </span>
        </div>
      </div>
    );
  }
  if (hasAttach) {
    const origName = (after?.original_name as string) || "File";
    const size = typeof after?.size === "number" ? (after.size / 1024).toFixed(1) : "0";
    return (
      <div className="mt-3 text-xs">
        <span className="font-medium text-zinc-500">{formatField("attachment_id")}:</span>{" "}
        <span className="bg-white border border-zinc-200 px-2 py-1 rounded-full">{origName}</span>{" "}
        <span className="text-zinc-500">• {size} KB</span>
      </div>
    );
  }
  const pretty = (obj?: Record<string, unknown> | null) =>
    Object.fromEntries(
      Object.entries(obj || {}).map(([k, v]) => [
        formatField(k),
        typeof v === "string" && v.includes("_") ? formatStatus(v) : v,
      ])
    );
  return (
    <pre className="mt-3 text-xs bg-zinc-50 border border-zinc-200 rounded-lg p-3 overflow-auto max-h-32 font-mono">
      {JSON.stringify({ before: pretty(before), after: pretty(after) }, null, 2)}
    </pre>
  );
}

export default function WorkOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [wo, setWo] = useState<WorkOrder | null>(null);
  const [audit, setAudit] = useState<AuditLog[]>([]);
  const [techs, setTechs] = useState<User[]>([]);
  const [error, setError] = useState("");
  const [assign, setAssign] = useState({
    technician_id: "",
    scheduled_start: "",
    scheduled_end: "",
  });
  const [status, setStatus] = useState<WorkOrderStatus>("open");

  const toLocalInput = (iso?: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const load = useCallback(async () => {
    try {
      const data = await apiJson<WorkOrder>(`/api/work-orders/${id}/`);
      setWo(data);
      setStatus(data.status);
      // Sync assign form with current assignment so UI clearly shows Assigned vs Reassign
      // Only auto-fill if user hasn't started editing; preserve manual edits otherwise
      setAssign((prev) => {
        if (prev.technician_id) return prev;
        return {
          technician_id: data.technician?.id || "",
          scheduled_start: data.scheduled_start ? toLocalInput(data.scheduled_start) : "",
          scheduled_end: data.scheduled_end ? toLocalInput(data.scheduled_end) : "",
        };
      });
      const a = await apiJson<PaginatedResponse<AuditLog> | AuditLog[]>(
        `/api/work-orders/${id}/audit/`
      );
      setAudit(Array.isArray(a) ? a : a.results || []);
    } catch (e: unknown) {
      setError(formatApiError(e));
    }
  }, [id]);

  const loadTechs = useCallback(async () => {
    try {
      const res = await apiJson<PaginatedResponse<User> | User[]>("/api/auth/users/");
      const userList = Array.isArray(res) ? res : res.results || [];
      setTechs(userList.filter((u) => u.role === "technician"));
    } catch {
      // Ignore user load error for technicians
    }
  }, []);

  useEffect(() => {
    load();
    loadTechs();
    const h = () => {
      load();
    };
    window.addEventListener("work_order_update", h);
    return () => window.removeEventListener("work_order_update", h);
  }, [load, loadTechs]);

  const isAssigned = Boolean(wo?.technician);
  const assignedOnlyStatuses: WorkOrderStatus[] = ["scheduled", "in_progress", "completed"];
  const isStatusRequiresAssignment = assignedOnlyStatuses.includes(status);
  const canAssign = user?.role !== "technician";
  const canStatus = user?.role === "technician" ? wo?.technician?.id === user.id : true;

  const doAssign = async () => {
    if (!assign.technician_id) {
      toast.warning("Please select a technician", { title: "Technician required" });
      return;
    }
    // If already assigned to same technician with same schedule, warn
    if (wo?.technician?.id === assign.technician_id && !assign.scheduled_start && !assign.scheduled_end) {
      toast.warning(`Already assigned to ${wo.technician.username}. Change schedule to update or pick another technician.`, { title: "Already assigned" });
      return;
    }
    try {
      const payload: {
        technician_id: string;
        scheduled_start?: string;
        scheduled_end?: string;
      } = { technician_id: assign.technician_id };
      if (assign.scheduled_start) {
        payload.scheduled_start = new Date(assign.scheduled_start).toISOString();
      }
      if (assign.scheduled_end) {
        payload.scheduled_end = new Date(assign.scheduled_end).toISOString();
      }
      const isReassign = Boolean(wo?.technician);
      await apiJson(`/api/work-orders/${id}/assign/`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      toast.success(
        isReassign ? `Reassigned to technician successfully` : "Technician assigned and scheduled successfully",
        { title: isReassign ? "Reassigned" : "Assigned" }
      );
      // mark recent self-assign so websocket slide toaster for same WO is suppressed (prevents 2nd duplicate)
      if (typeof window !== "undefined") {
        (window as unknown as { __lastAssignAt?: number; __lastAssignWo?: string }).__lastAssignAt = Date.now();
        (window as unknown as { __lastAssignWo?: string }).__lastAssignWo = id;
      }
      await load();
    } catch (e: unknown) {
      // Surface scheduling conflict with clear actionable message
      const msg = formatApiError(e);
      const isConflict = e instanceof Error && (e as unknown as { status?: number }).status === 409 || msg.toLowerCase().includes("already assigned") || msg.toLowerCase().includes("scheduling conflict") || msg.toLowerCase().includes("conflict");
      if (isConflict) {
        toast.error(e, { title: "Technician busy — scheduling conflict" });
      } else {
        toast.error(e);
      }
    }
  };

  const doStatus = async () => {
    // Gating: if not assigned, block statuses that require assignment
    if (!wo) return;
    if (!isAssigned && isStatusRequiresAssignment) {
      toast.warning(`Cannot move to "${formatStatus(status)}" without an assigned technician. Assign a technician first.`, {
        title: "Assignment required",
      });
      return;
    }
    // Block trivial no-op
    if (wo.status === status) {
      toast.warning(`Already in "${formatStatus(status)}"`, { title: "No change" });
      return;
    }
    try {
      const eventId = `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      await apiJson("/api/events/", {
        method: "POST",
        body: JSON.stringify({
          eventId,
          workOrderId: id,
          type: "status_changed",
          occurredAt: new Date().toISOString(),
          payload: { status },
        }),
      });
      toast.success(`Status updated to ${formatStatus(status)}`, { title: "Success" });
      if (typeof window !== "undefined") {
        (window as unknown as { __lastStatusAt?: number; __lastStatusWo?: string }).__lastStatusAt = Date.now();
        (window as unknown as { __lastStatusWo?: string }).__lastStatusWo = id;
      }
      await load();
    } catch (e: unknown) {
      toast.error(e);
    }
  };

  const doUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await apiFetch(`/api/work-orders/${id}/attachments/`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const j = (await res.json()) as { error?: { message?: string; details?: unknown } };
        const msg = formatApiError(j);
        toast.error(msg, { title: "Upload Failed" });
        return;
      }
      toast.success("Attachment uploaded successfully");
      await load();
    } catch (err: unknown) {
      toast.error(err, { title: "Upload Failed" });
    }
  };

  if (error)
    return (
      <>
        <Topbar title="Work Order" />
        <div className="p-6 text-red-600">
          {error}{" "}
          <button
            type="button"
            onClick={() => router.push("/work-orders")}
            className="underline"
          >
            Back
          </button>
        </div>
      </>
    );
  if (!wo)
    return (
      <>
        <Topbar title="Work Order" />
        <div className="p-6 text-slate-500">Loading…</div>
      </>
    );

  return (
    <>
      <Topbar
        title={`${wo.ref} — ${wo.title}`}
        subtitle={`${wo.site_name || "No site"} • ${formatPriority(wo.priority)}`}
      />
      <div className="p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-3 gap-6 w-full">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-zinc-200 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs bg-zinc-50 border border-zinc-200 px-2 py-1 rounded-md">
                    {wo.ref}
                  </span>
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border inline-flex items-center gap-1.5 ${
                      STATUS_PILL[wo.status] || "bg-white border-zinc-200"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        STATUS_DOT[wo.status] || "bg-zinc-400"
                      }`}
                    />
                    {formatStatus(wo.status)}
                  </span>
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                      PRIORITY_PILL[wo.priority] || "bg-zinc-900 text-white border-zinc-900"
                    }`}
                  >
                    {formatPriority(wo.priority)}
                  </span>
                </div>
                <h2 className="text-xl font-semibold mt-3 tracking-tight">{wo.title}</h2>
                <p className="text-sm text-zinc-600 mt-2 leading-relaxed font-light">
                  {wo.description || "No description"}
                </p>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
              <div className="bg-zinc-50 rounded-xl p-3 border border-zinc-100">
                <div className="text-xs text-zinc-500 font-medium tracking-wide">Technician</div>
                <div className="font-medium mt-1">
                  {wo.technician?.username || "Unassigned"}
                </div>
                <div className="text-xs text-zinc-500 font-light">
                  {wo.technician?.email || ""}
                </div>
              </div>
              <div className="bg-zinc-50 rounded-xl p-3 border border-zinc-100">
                <div className="text-xs text-zinc-500 font-medium tracking-wide">Schedule</div>
                <div className="font-medium mt-1">
                  {wo.scheduled_start ? new Date(wo.scheduled_start).toLocaleString() : "—"}
                </div>
                <div className="text-xs text-zinc-500 font-light">
                  → {wo.scheduled_end ? new Date(wo.scheduled_end).toLocaleString() : "—"}
                </div>
              </div>
              <div className="bg-zinc-50 rounded-xl p-3 border border-zinc-100">
                <div className="text-xs text-zinc-500 font-medium tracking-wide">Site</div>
                <div className="font-medium mt-1">{wo.site_name || "—"}</div>
              </div>
              <div className="bg-zinc-50 rounded-xl p-3 border border-zinc-100">
                <div className="text-xs text-zinc-500 font-medium tracking-wide">Created</div>
                <div className="font-medium mt-1">
                  {new Date(wo.created_at).toLocaleString()}
                </div>
                <div className="text-xs text-zinc-500 font-light">
                  by {wo.creator?.username || "—"}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-zinc-200 p-6">
            <h3 className="font-semibold text-sm tracking-tight">Attachments</h3>
            <div className="flex items-center gap-3 my-4">
              <label className="h-9 px-4 bg-zinc-900 text-white rounded-lg text-sm font-medium inline-flex items-center cursor-pointer hover:bg-zinc-800 transition-colors">
                Upload file{" "}
                <input
                  type="file"
                  className="hidden"
                  accept="image/*,application/pdf"
                  onChange={doUpload}
                />
              </label>
              <span className="text-xs text-zinc-500 font-light">Images or PDF, max 10MB</span>
            </div>
            <div className="space-y-2">
              {(wo.attachments || []).map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between p-3 border border-zinc-200 rounded-xl bg-zinc-50"
                >
                  <div>
                    <div className="text-sm font-medium">{a.original_name}</div>
                    <div className="text-xs text-zinc-500 font-light">
                      {a.mime_type} • {(a.size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.preventDefault();
                      const res = await apiFetch(
                        `/api/work-orders/${wo.id}/attachments/${a.id}/download/`
                      );
                      const blob = await res.blob();
                      const url = URL.createObjectURL(blob);
                      const an = document.createElement("a");
                      an.href = url;
                      an.download = a.original_name;
                      an.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="text-xs font-medium underline underline-offset-4"
                  >
                    Download
                  </button>
                </div>
              ))}
              {(wo.attachments || []).length === 0 && (
                <div className="text-sm text-zinc-500 font-light py-6 text-center border border-dashed border-zinc-200 rounded-xl">
                  No attachments
                </div>
              )}
            </div>
          </div>

          {/* Activity history */}
          <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-zinc-900 text-white flex items-center justify-center">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    <circle cx="12" cy="16" r="1.2" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-sm leading-none tracking-tight">
                    Activity history
                  </h3>
                  <p className="text-xs text-zinc-500 mt-1 font-light">
                    <span className="font-medium text-zinc-700">{audit.length}</span> events
                  </p>
                </div>
              </div>
            </div>

            {audit.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <div className="w-10 h-10 rounded-xl bg-zinc-50 border border-zinc-200 flex items-center justify-center mx-auto text-zinc-400">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path d="M12 8v4l3 3" />
                    <circle cx="12" cy="12" r="8" />
                  </svg>
                </div>
                <div className="text-sm font-medium mt-3">No activity yet</div>
                <div className="text-xs text-zinc-500 mt-1 max-w-[28ch] mx-auto font-light">
                  Creation, assignment and status changes appear here.
                </div>
              </div>
            ) : (
              <div className="px-6 py-6">
                <div className="relative">
                  <div className="absolute left-[15px] top-2 bottom-2 w-px bg-zinc-100 hidden sm:block" />
                  <div className="space-y-4">
                    {audit.map((entry) => {
                      const meta = getActionMeta(entry.action);
                      const time = new Date(entry.timestamp);
                      const timeStr = time.toLocaleString(undefined, {
                        month: "short",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      });
                      const actorName = entry.actor?.username || "system";
                      return (
                        <div key={entry.id} className="relative flex gap-4">
                          <div
                            className={`hidden sm:flex w-8 h-8 rounded-full border bg-white items-center justify-center shrink-0 z-10 ${meta.ring}`}
                          >
                            <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
                          </div>
                          <div className="flex-1 min-w-0 bg-white border border-zinc-200 rounded-xl p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${meta.badge}`}
                                >
                                  {meta.label}
                                </span>
                                <span className="text-xs text-zinc-400 font-mono">
                                  #{entry.target_type}
                                </span>
                              </div>
                              <span className="text-xs text-zinc-500 font-light whitespace-nowrap">
                                {timeStr}
                              </span>
                            </div>
                            <div className="mt-2.5 flex items-center gap-2 text-sm min-w-0">
                              <span className="w-6 h-6 rounded-full bg-zinc-900 text-white flex items-center justify-center text-xs font-medium shrink-0">
                                {actorName.slice(0, 2).toUpperCase()}
                              </span>
                              <span className="font-medium truncate">{actorName}</span>
                              <span className="text-zinc-400">•</span>
                              <span className="text-zinc-500 truncate font-light">
                                {meta.desc}
                              </span>
                            </div>
                            <DiffBlock before={entry.before} after={entry.after} />
                            <div className="mt-3 flex items-center gap-2 text-xs text-zinc-400 font-mono font-light">
                              <span className="px-1.5 py-0.5 rounded bg-zinc-50 border border-zinc-100">
                                {entry.request_id
                                  ? entry.request_id.slice(0, 8)
                                  : "no-req-id"}
                              </span>
                              <span>{time.toLocaleTimeString()}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {canAssign && (
            <div className="bg-white rounded-xl border border-zinc-200 p-5">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm tracking-tight">
                  {isAssigned ? "Assigned technician" : "Assign technician"}
                </h3>
                {isAssigned && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Assigned
                  </span>
                )}
              </div>
              {isAssigned && wo?.technician && (
                <div className="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-medium shrink-0">
                    {wo.technician.username.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-emerald-900 truncate">{wo.technician.username}</div>
                    <div className="text-xs text-emerald-700 truncate font-light">{wo.technician.email}</div>
                  </div>
                </div>
              )}
              {!isAssigned && (
                <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 font-light">
                  Unassigned — status changes to Scheduled / In Progress / Completed will be blocked until a technician is assigned.
                </p>
              )}
              <div className="mt-4 space-y-3">
                <select
                  value={assign.technician_id}
                  onChange={(e) =>
                    setAssign({
                      ...assign,
                      technician_id: e.target.value,
                    })
                  }
                  className="w-full h-10 px-3 rounded-lg border border-zinc-200 bg-white text-sm focus:border-zinc-900"
                >
                  <option value="">{isAssigned ? "Reassign to…" : "Select technician"}</option>
                  {techs.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.username} ({t.email}) {wo?.technician?.id === t.id ? "• current" : ""}
                    </option>
                  ))}
                </select>
                <input
                  type="datetime-local"
                  value={assign.scheduled_start}
                  onChange={(e) =>
                    setAssign({
                      ...assign,
                      scheduled_start: e.target.value,
                    })
                  }
                  className="w-full h-10 px-3 rounded-lg border border-zinc-200 text-sm focus:border-zinc-900"
                  placeholder="Start"
                />
                <input
                  type="datetime-local"
                  value={assign.scheduled_end}
                  onChange={(e) =>
                    setAssign({
                      ...assign,
                      scheduled_end: e.target.value,
                    })
                  }
                  className="w-full h-10 px-3 rounded-lg border border-zinc-200 text-sm focus:border-zinc-900"
                  placeholder="End"
                />
                <button
                  type="button"
                  onClick={doAssign}
                  disabled={!assign.technician_id}
                  className="w-full h-10 bg-zinc-900 hover:bg-black disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {isAssigned ? "Reassign" : "Assign"}
                </button>
                <p className="text-xs text-zinc-500 font-light text-center">
                  1 hour gap required on same day — busy technicians will show a clear conflict toaster.
                </p>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-zinc-200 p-5">
            <h3 className="font-semibold text-sm tracking-tight">Update Status</h3>
            {!isAssigned && (
              <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 font-light">
                Assign a technician first — only Open / Blocked / Cancelled allowed while unassigned.
              </p>
            )}
            <div className="mt-4 space-y-3">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as WorkOrderStatus)}
                className="w-full h-10 px-3 rounded-lg border border-zinc-200 bg-white text-sm focus:border-zinc-900 disabled:opacity-50"
              >
                <option value="open">Open</option>
                <option value="scheduled" disabled={!isAssigned}>
                  Scheduled {!isAssigned ? "(needs technician)" : ""}
                </option>
                <option value="in_progress" disabled={!isAssigned}>
                  In Progress {!isAssigned ? "(needs technician)" : ""}
                </option>
                <option value="blocked">Blocked</option>
                <option value="completed" disabled={!isAssigned}>
                  Completed {!isAssigned ? "(needs technician)" : ""}
                </option>
                <option value="cancelled">Cancelled</option>
              </select>
              <button
                type="button"
                onClick={doStatus}
                disabled={!canStatus || (!isAssigned && isStatusRequiresAssignment)}
                className="w-full h-10 bg-zinc-900 hover:bg-black disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Update Status
              </button>
              {!canStatus && (
                <div className="text-xs text-zinc-500 font-light">Only assigned technician can submit</div>
              )}
              {!isAssigned && isStatusRequiresAssignment && (
                <div className="text-xs text-amber-700 font-light">Assign a technician before moving to {formatStatus(status)}.</div>
              )}
              {wo?.status === "completed" && (
                <div className="text-xs text-zinc-500 font-light">Completed work orders are final.</div>
              )}
              {wo?.status === "cancelled" && (
                <div className="text-xs text-zinc-500 font-light">Cancelled work orders cannot be resumed.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
