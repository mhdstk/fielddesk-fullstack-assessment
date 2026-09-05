"use client";
import React, { useState } from "react";
import { apiJson, ApiError } from "@/lib/api";
import { Topbar } from "@/components/Topbar";
import { useRouter } from "next/navigation";
import { WorkOrder, WorkOrderPriority } from "@/lib/types";

export default function NewWorkOrder() {
  const router = useRouter();
  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: "medium" as WorkOrderPriority,
    site_name: "",
    scheduled_start: "",
    scheduled_end: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const payload: {
        title: string;
        description: string;
        priority: WorkOrderPriority;
        site_name: string;
        scheduled_start?: string;
        scheduled_end?: string;
      } = {
        title: form.title,
        description: form.description,
        priority: form.priority,
        site_name: form.site_name,
      };
      if (form.scheduled_start) {
        payload.scheduled_start = new Date(form.scheduled_start).toISOString();
      }
      if (form.scheduled_end) {
        payload.scheduled_end = new Date(form.scheduled_end).toISOString();
      }
      const wo = await apiJson<WorkOrder>("/api/work-orders/", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      router.push(`/work-orders/${wo.id}`);
    } catch (e: unknown) {
      if (e instanceof ApiError && e.data?.error?.message) {
        setError(e.data.error.message);
      } else {
        setError(e instanceof Error ? e.message : "Failed to create work order");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Topbar title="New Work Order" subtitle="Org-isolated • visible to your organisation only" />
      <div className="p-6 sm:p-8 w-full">
        <form
          onSubmit={submit}
          className="bg-white rounded-xl border border-zinc-200 p-6 sm:p-8 space-y-5"
        >
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm px-3 py-2">
              {error}
            </div>
          )}
          <div>
            <label className="text-sm font-medium">Title *</label>
            <input
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="mt-1.5 w-full h-10 px-3 rounded-lg border border-zinc-200 bg-white text-sm focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
              placeholder="HVAC maintenance — Building A"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="mt-1.5 w-full px-3 py-2.5 rounded-lg border border-zinc-200 bg-white text-sm focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 font-light"
              placeholder="Describe the work…"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Priority</label>
              <select
                value={form.priority}
                onChange={(e) =>
                  setForm({ ...form, priority: e.target.value as WorkOrderPriority })
                }
                className="mt-1.5 w-full h-10 px-3 rounded-lg border border-zinc-200 bg-white text-sm focus:border-zinc-900"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Site name</label>
              <input
                value={form.site_name}
                onChange={(e) => setForm({ ...form, site_name: e.target.value })}
                className="mt-1.5 w-full h-10 px-3 rounded-lg border border-zinc-200 bg-white text-sm focus:border-zinc-900"
                placeholder="Site A — Downtown"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Scheduled start</label>
              <input
                type="datetime-local"
                value={form.scheduled_start}
                onChange={(e) => setForm({ ...form, scheduled_start: e.target.value })}
                className="mt-1.5 w-full h-10 px-3 rounded-lg border border-zinc-200 bg-white text-sm focus:border-zinc-900"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Scheduled end</label>
              <input
                type="datetime-local"
                value={form.scheduled_end}
                onChange={(e) => setForm({ ...form, scheduled_end: e.target.value })}
                className="mt-1.5 w-full h-10 px-3 rounded-lg border border-zinc-200 bg-white text-sm focus:border-zinc-900"
              />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="h-10 px-6 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-60 text-white rounded-lg font-medium text-sm transition-colors"
            >
              {loading ? "Creating…" : "Create work order"}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="h-10 px-5 border border-zinc-200 bg-white rounded-lg text-sm font-medium hover:bg-zinc-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
