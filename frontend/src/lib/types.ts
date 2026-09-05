export type UserRole = "owner" | "dispatcher" | "technician";

export interface Organisation {
  id: string;
  name: string;
  slug: string;
  storage_limit_bytes?: number;
}

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  organisation: Organisation;
  first_name?: string;
  last_name?: string;
  is_active?: boolean;
}

export type WorkOrderPriority = "low" | "medium" | "high" | "urgent";

export type WorkOrderStatus =
  | "draft"
  | "open"
  | "scheduled"
  | "in_progress"
  | "blocked"
  | "completed"
  | "cancelled";

export interface Attachment {
  id: string;
  original_name: string;
  mime_type: string;
  size: number;
  created_at: string;
  file: string;
  uploaded_by?: {
    id: string;
    username: string;
  } | null;
}

export interface WorkOrder {
  id: string;
  ref: string;
  title: string;
  description: string;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  site_name: string;
  technician?: User | null;
  technician_id?: string | null;
  creator?: User | null;
  scheduled_start?: string | null;
  scheduled_end?: string | null;
  attachments?: Attachment[];
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actor?: {
    id: string;
    username: string;
    role: string;
  } | null;
  action: string;
  target_type: string;
  target_id: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  request_id?: string | null;
}

export interface Stats {
  total: number;
  by_status: Record<string, number>;
  by_priority: Record<string, number>;
  my_assigned?: number | null;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface ProgressEvent {
  id: string;
  eventId: string;
  workOrderId: string;
  type: string;
  occurredAt: string;
  payload: Record<string, unknown>;
  created_at: string;
  idempotentReplay?: boolean;
}
