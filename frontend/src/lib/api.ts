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
  code?: string;
  errorCode?: string;
  error_code?: string;
  message?: string;
  errorMessage?: string;
  error_message?: string;
  detail?: string;
  details?: unknown;
  errorDetails?: unknown;
  error_details?: unknown;
  requestId?: string;
  request_id?: string;
  non_field_errors?: unknown;
  [key: string]: unknown;
}

export function humanizeErrorMessage(raw: string): string {
  if (!raw) return "";
  let msg = raw.trim();

  // Common technical patterns
  if (/scheduled_end\s+must\s+be\s+after\s+scheduled_start/i.test(msg)) {
    return "Scheduled end time must be after scheduled start time.";
  }
  if (/Must be after scheduled_start/i.test(msg)) {
    return "Scheduled end time must be after scheduled start time.";
  }

  // Replace snake_case identifiers
  msg = msg.replace(/\bscheduled_end\b/gi, "scheduled end time");
  msg = msg.replace(/\bscheduled_start\b/gi, "scheduled start time");
  msg = msg.replace(/\btechnician_id\b/gi, "technician");
  msg = msg.replace(/\bsite_name\b/gi, "site name");
  msg = msg.replace(/\bwork_order_id\b/gi, "work order");
  msg = msg.replace(/\b([a-z]+)_([a-z]+)\b/g, "$1 $2");

  msg = msg.trim();
  if (msg.length > 0) {
    msg = msg.charAt(0).toUpperCase() + msg.slice(1);
  }
  return msg;
}

export function extractErrorMessage(
  payload?: ApiErrorPayload | null,
  fallbackMsg: string = "Request failed"
): string {
  if (!payload) return fallbackMsg;

  // 1. Check nested standard error object
  const errObj = payload.error || payload;
  const rawDetails = errObj.details || payload.details || payload.errorDetails || payload.error_details;
  const rawMessage = errObj.message || payload.message || payload.errorMessage || payload.error_message || payload.detail;

  if (rawDetails) {
    if (typeof rawDetails === "string" && rawDetails.trim()) {
      return humanizeErrorMessage(rawDetails);
    }
    if (Array.isArray(rawDetails) && rawDetails.length > 0) {
      return rawDetails.map((d) => humanizeErrorMessage(String(d))).join(", ");
    }
    if (typeof rawDetails === "object" && rawDetails !== null) {
      const msgs: string[] = [];
      const d = rawDetails as Record<string, unknown>;

      if (Array.isArray(d.non_field_errors) && d.non_field_errors.length > 0) {
        msgs.push(...d.non_field_errors.map((x) => humanizeErrorMessage(String(x))));
      } else if (typeof d.non_field_errors === "string" && d.non_field_errors.trim()) {
        msgs.push(humanizeErrorMessage(d.non_field_errors));
      }

      if (typeof d.detail === "string" && d.detail.trim()) {
        msgs.push(humanizeErrorMessage(d.detail));
      }

      for (const [key, val] of Object.entries(d)) {
        if (key === "non_field_errors" || key === "detail") continue;
        const fieldName = key.replace(/_/g, " ");
        if (Array.isArray(val) && val.length > 0) {
          msgs.push(`${fieldName}: ${val.map((x) => humanizeErrorMessage(String(x))).join(", ")}`);
        } else if (typeof val === "string" && val.trim()) {
          msgs.push(`${fieldName}: ${humanizeErrorMessage(val)}`);
        } else if (typeof val === "object" && val !== null) {
          msgs.push(`${fieldName}: ${JSON.stringify(val)}`);
        }
      }

      if (msgs.length > 0) {
        return msgs.join(" • ");
      }
    }
  }

  if (typeof rawMessage === "string" && rawMessage.trim() && rawMessage !== "Validation failed") {
    return humanizeErrorMessage(rawMessage);
  }
  if (typeof rawMessage === "string" && rawMessage.trim()) {
    return humanizeErrorMessage(rawMessage);
  }

  return fallbackMsg;
}

export function formatApiError(err: unknown): string {
  if (!err) return "An unexpected error occurred.";
  if (err instanceof ApiError) {
    return extractErrorMessage(err.data, err.message);
  }
  if (typeof err === "object" && err !== null && "data" in err) {
    const maybeApi = err as { data?: ApiErrorPayload; message?: string };
    return extractErrorMessage(maybeApi.data, maybeApi.message || "Request failed");
  }
  if (typeof err === "object" && err !== null && "error" in err) {
    return extractErrorMessage(err as ApiErrorPayload, "Request failed");
  }
  if (err instanceof Error) {
    return humanizeErrorMessage(err.message);
  }
  if (typeof err === "string") {
    return humanizeErrorMessage(err);
  }
  return "An unexpected error occurred.";
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
    const message = extractErrorMessage(json, json.error?.message || text || "Request failed");
    throw new ApiError(res.status, message, json);
  }
  const ct = res.headers.get("content-type");
  if (ct?.includes("text/csv")) {
    return (await res.text()) as unknown as T;
  }
  return res.json() as Promise<T>;
}
