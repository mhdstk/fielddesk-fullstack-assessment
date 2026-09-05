const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

export function setTokens(access: string, refresh: string) {
  localStorage.setItem("access_token", access);
  localStorage.setItem("refresh_token", refresh);
}

export function clearTokens() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
}

export interface ApiErrorPayload {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
    requestId?: string;
  };
}

export class ApiError extends Error {
  status: number;
  data?: ApiErrorPayload;

  constructor(status: number, message: string, data?: ApiErrorPayload) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

export async function apiFetch(path: string, opts: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers: Record<string, string> = {
    "X-Request-ID": crypto.randomUUID(),
    ...((opts.headers as Record<string, string>) || {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (opts.body && !(opts.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });

  if (res.status === 401 && token) {
    // try refresh
    const refresh = localStorage.getItem("refresh_token");
    if (refresh) {
      const r = await fetch(`${API_BASE}/api/auth/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      });
      if (r.ok) {
        const data = (await r.json()) as { access: string };
        localStorage.setItem("access_token", data.access);
        headers["Authorization"] = `Bearer ${data.access}`;
        return fetch(`${API_BASE}${path}`, { ...opts, headers });
      } else {
        clearTokens();
        if (typeof window !== "undefined") {
          window.location.replace("/login");
        }
      }
    }
  }
  return res;
}

export async function apiJson<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await apiFetch(path, opts);
  if (!res.ok) {
    const text = await res.text();
    let json: ApiErrorPayload;
    try {
      json = JSON.parse(text) as ApiErrorPayload;
    } catch {
      json = { error: { message: text } };
    }
    throw new ApiError(res.status, json.error?.message || text || "Request failed", json);
  }
  const ct = res.headers.get("content-type");
  if (ct?.includes("text/csv")) {
    return (await res.text()) as unknown as T;
  }
  return res.json() as Promise<T>;
}
