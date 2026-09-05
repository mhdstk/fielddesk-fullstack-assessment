"use client";
import { useEffect, useState, useCallback } from "react";
import { apiJson, formatApiError } from "@/lib/api";
import { Topbar } from "@/components/Topbar";
import { useAuth } from "@/lib/auth";
import { User, PaginatedResponse, UserRole } from "@/lib/types";
import { toast } from "@/lib/toast";

export default function UsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [newRole, setNewRole] = useState<UserRole>("technician");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiJson<PaginatedResponse<User> | User[]>("/api/auth/users/");
      setUsers(Array.isArray(data) ? data : data.results || []);
    } catch (e: unknown) {
      setError(formatApiError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (user?.role !== "owner") {
    return (
      <>
        <Topbar title="Users" subtitle="Owner only" />
        <div className="p-6 sm:p-8 w-full">
          <div className="rounded-xl border border-zinc-200 bg-white p-6">
            <div className="text-sm font-medium">Restricted</div>
            <div className="text-sm text-zinc-500 font-light mt-1">
              Only <span className="font-medium text-zinc-900">owner</span> can manage users. Your
              role is <span className="font-medium capitalize">{user?.role}</span>.
            </div>
          </div>
        </div>
      </>
    );
  }

  const saveRole = async (id: string) => {
    try {
      await apiJson(`/api/auth/users/${id}/`, {
        method: "PATCH",
        body: JSON.stringify({ role: newRole }),
      });
      toast.success("User role updated successfully");
      setEditing(null);
      await load();
    } catch (e: unknown) {
      const msg = formatApiError(e);
      setError(msg);
      toast.error(e);
    }
  };

  return (
    <>
      <Topbar title="Users" subtitle={`${users.length} members • ${user?.organisation.name}`} />
      <div className="p-6 sm:p-8 w-full">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm mb-4">
            {error}
          </div>
        )}
        {loading ? (
          <div className="text-zinc-500 text-sm font-light">Loading users…</div>
        ) : (
          <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-white text-xs font-medium tracking-widest uppercase text-zinc-400 border-b border-zinc-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">User</th>
                    <th className="px-4 py-3 text-left font-medium">Role</th>
                    <th className="px-4 py-3 text-left font-medium">Email</th>
                    <th className="px-4 py-3 text-right font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-zinc-50/70">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-zinc-900 text-white flex items-center justify-center text-xs font-medium">
                            {u.username.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-sm">{u.username}</div>
                            <div className="text-xs text-zinc-500 font-mono font-light">
                              {u.id.slice(0, 8)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {editing === u.id ? (
                          <select
                            value={newRole}
                            onChange={(e) => setNewRole(e.target.value as UserRole)}
                            className="h-8 px-2 rounded-lg border border-zinc-200 bg-white text-sm focus:border-zinc-900"
                          >
                            <option value="owner">owner</option>
                            <option value="dispatcher">dispatcher</option>
                            <option value="technician">technician</option>
                          </select>
                        ) : (
                          <span className="text-xs px-2.5 py-1 rounded-full border border-zinc-200 bg-white capitalize font-medium">
                            {u.role}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-600 font-light text-sm">{u.email}</td>
                      <td className="px-4 py-3 text-right">
                        {editing === u.id ? (
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditing(null)}
                              className="h-8 px-3 rounded-lg border border-zinc-200 bg-white text-xs font-medium"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => saveRole(u.id)}
                              className="h-8 px-3 rounded-lg bg-zinc-900 text-white text-xs font-medium"
                            >
                              Save
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setEditing(u.id);
                              setNewRole(u.role);
                            }}
                            className="text-xs font-medium underline underline-offset-4"
                          >
                            Change role
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 bg-zinc-50 border-t border-zinc-100 text-xs text-zinc-500 font-light">
              Role changes are audited and org-isolated.
            </div>
          </div>
        )}
      </div>
    </>
  );
}
