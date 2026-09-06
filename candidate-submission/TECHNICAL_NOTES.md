# Technical notes

Complete this document as part of the submission.

## Candidate

- Name: Shaheen TK
- GitHub username: mhdstk
- Final commit SHA: e752405
- Screen-recording link: [To be provided in PR description]

## Local setup

### Option A: Docker Compose (Recommended)

1. Copy the environment configuration:
   ```bash
   cp .env.example .env
   ```
2. Build and start all services (PostgreSQL, Redis, Django API + Channels, Celery Worker, Next.js Web):
   ```bash
   docker compose up --build
   ```
3. Access the services:
   - Frontend: [http://localhost:3000](http://localhost:3000)
   - API Backend: [http://localhost:8000](http://localhost:8000)
   - Liveness probe: `curl http://localhost:8000/health/`
   - Readiness probe: `curl http://localhost:8000/ready/`

### Option B: Local Development Without Docker

#### Backend API & Worker
```bash
cd backend
poetry install --no-root
poetry run python manage.py migrate
poetry run python manage.py seed
# Start ASGI API server (Daphne with WebSockets):
poetry run daphne -b 127.0.0.1 -p 8000 config.asgi:application
# In a separate terminal, start Celery worker:
poetry run celery -A config worker -l info
```

#### Frontend Web Application
```bash
cd frontend
npm install --legacy-peer-deps
NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev
# Accessible at http://localhost:3000
```

## Sample accounts

The database is seeded with two isolated organisations (`Acme Field Co` and `Globex Maintenance`) with all three required roles (`owner`, `dispatcher`, `technician`) plus an extra technician for concurrency testing:

| Organisation | Username | Role | Password | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Acme Field Co** (`acme`) | `acme_owner` | Owner | `Password123!` | Manages organisation settings & user roles |
| **Acme Field Co** (`acme`) | `acme_dispatcher` | Dispatcher | `Password123!` | Creates, schedules, and assigns work orders |
| **Acme Field Co** (`acme`) | `acme_technician` | Technician | `Password123!` | Views assigned work orders & submits events |
| **Acme Field Co** (`acme`) | `acme_tech2` | Technician | `Password123!` | Secondary technician for scheduling tests |
| **Globex Maintenance** (`globex`) | `globex_owner` | Owner | `Password123!` | Manages Globex settings & user roles |
| **Globex Maintenance** (`globex`) | `globex_dispatcher` | Dispatcher | `Password123!` | Creates, schedules, and assigns work orders |
| **Globex Maintenance** (`globex`) | `globex_technician` | Technician | `Password123!` | Views assigned Globex work & submits events |
| **Globex Maintenance** (`globex`) | `globex_tech2` | Technician | `Password123!` | Secondary technician for Globex |

## Verification results

| Check | Command | Result |
| :--- | :--- | :--- |
| Backend tests | `cd backend && poetry run pytest -v` | **15 passed** (100% pass) |
| Frontend tests | `cd frontend && npm test` | **9 passed** (100% pass) |
| Integration tests | `cd backend && poetry run pytest -k "test_realtime_websocket_org_isolation or test_concurrent_scheduling_conflict or test_worker_retry_and_duplicate"` | **Passed** |
| Lint | `cd frontend && npm run lint` | **0 errors, 0 warnings** |
| Build | `cd frontend && npm run build` | **Compiled successfully** (Next.js Turbopack) |

## Architecture

FieldDesk is constructed as a decoupled, multi-tenant field service management system composed of:

```
                  ┌─────────────────────────────────┐
                  │    Next.js 16 (React 19) Web    │
                  │   App Router, TS, Tailwind, WS  │
                  └───────────────┬─────────────────┘
                                  │ REST API + WebSockets (JWT Bearer)
                  ┌───────────────▼─────────────────┐
                  │     Django 5.2 + DRF Backend     │
                  │    Daphne ASGI (Channels 4)     │
                  │  Structured Logs + X-Request-ID │
                  └───────────────┬─────────────────┘
                                  │
                 ┌────────────────┴────────────────┐
                 ▼                                 ▼
      ┌────────────────────┐            ┌────────────────────┐
      │ PostgreSQL 16 DB   │            │   Redis 7.0        │
      │ Row Locks + Quotas │            │ Broker + Channel   │
      │ Audit & Events     │            │ Layer + Caching    │
      └────────────────────┘            └─────────┬──────────┘
                                                  │ Task queue
                                        ┌─────────▼──────────┐
                                        │ Celery Worker      │
                                        │ Exponential Retry  │
                                        │ Notification Mocks │
                                        └────────────────────┘
```

### Component Responsibilities:
1. **Frontend (`frontend/`)**: Modern Single Page Application built with Next.js 16 (App Router), React 19, TypeScript, and Tailwind CSS. Connects to the backend via typed REST clients and a persistent WebSocket connection for live dashboard and list updates. Client-side state never dictates authority; all actions are validated against backend responses.
2. **Backend API (`backend/`)**: Django 5 + Django REST Framework exposing secure REST endpoints, centralised input validators, structured JSON logging, rate limiting, and request correlation IDs (`X-Request-ID`).
3. **Real-time Server (`backend/apps/realtime/`)**: Django Channels 4 ASGI consumer on Daphne backed by `channels_redis`, broadcasting live mutation events strictly within the authenticated user's organisation group.
4. **Background Worker (`backend/apps/notifications/`)**: Celery worker consuming async notification dispatch jobs with exponential backoff retries, idempotent attempt tracking, and controllable mock provider simulation.
5. **Database**: PostgreSQL 16 enforcing referential integrity, tenant scoping, atomic transactions, and row-level serialization.

## Database design

### Principal Models and Tables:
1. **`accounts.Organisation` (`accounts_organisation`)**:
   - `id` (UUID PK), `name`, `slug` (unique), `storage_limit_bytes` (bigint), `created_at`.
2. **`accounts.User` (`accounts_user`)**:
   - Extends Django's `AbstractUser`, `id` (UUID PK), `organisation_id` (FK to Organisation), `role` (`owner`, `dispatcher`, `technician`), `email`.
   - Constraints: `UniqueConstraint(organisation, username)`, `UniqueConstraint(organisation, email)`.
3. **`workorders.WorkOrder` (`workorders_workorder`)**:
   - `id` (UUID PK), `organisation_id` (FK), `ref` (char, unique per org), `title`, `description`, `priority` (`low`, `medium`, `high`, `urgent`), `status` (`draft`, `open`, `scheduled`, `in_progress`, `blocked`, `completed`, `cancelled`), `technician_id` (FK to User, nullable), `scheduled_start`, `scheduled_end`, `site_name`, `creator_id` (FK to User), `created_at`, `updated_at`.
   - Constraints: `UniqueConstraint(organisation, ref)`.
   - Indexes: `(organisation, status)`, `(organisation, technician, scheduled_start)`, `(organisation, created_at)`.
4. **`workorders.Attachment` (`workorders_attachment`)**:
   - `id` (UUID PK), `organisation_id` (FK), `work_order_id` (FK), `file` (FileField stored as safe UUID filename), `original_name`, `mime_type`, `size`, `uploaded_by_id` (FK), `created_at`.
5. **`events.ProgressEvent` (`events_progressevent`)**:
   - `id` (UUID PK), `event_id` (client idempotency key), `organisation_id` (FK), `work_order_id` (FK), `type`, `occurred_at`, `payload` (JSON), `created_by_id` (FK), `raw_request` (JSON immutable audit snapshot), `created_at`.
   - Constraints: `UniqueConstraint(organisation, event_id)`.
   - Indexes: `(organisation, work_order)`, `(organisation, event_id)`.
6. **`notifications.NotificationAttempt` (`notifications_notificationattempt`)**:
   - `id` (UUID PK), `organisation_id` (FK), `work_order_id` (FK), `technician_id` (FK), `status` (`pending`, `success`, `temp_fail`, `perm_fail`), `attempts`, `last_error`, `created_at`, `updated_at`.
   - Constraints: `UniqueConstraint(work_order, technician)`.
7. **`audit.AuditLog` (`audit_auditlog`)**:
   - `id` (UUID PK), `organisation_id` (FK), `actor_id` (FK nullable for system events), `action`, `target_type`, `target_id`, `before` (JSON), `after` (JSON), `timestamp`, `request_id`.

### Migration Strategy:
Standard Django migration files (`0001_initial.py`) managed via `manage.py migrate`. Migrations run automatically on container startup.

## Authentication, roles and organisation isolation

### Authentication:
- Authenticated via JSON Web Tokens (`rest_framework_simplejwt`).
- Access tokens (30 min lifetime) and refresh tokens (7 days). Tokens contain cryptographically verified claims: `user_id`, `org_id`, `role`, and `username`.
- Passwords hashed using Argon2 (`Argon2PasswordHasher`) with PBKDF2 fallback.

### Role Enforcement (RBAC):
- **Owner**: Full administrative access across the organisation, including user management and role assignment.
- **Dispatcher**: Create, edit, schedule, assign work orders, upload attachments, export CSV, and monitor real-time dashboards. Cannot change user roles.
- **Technician**: View only work orders explicitly assigned to them; submit progress events (`status_changed`, `note_added`, etc.) and upload attachments for assigned work orders. Technicians cannot create or assign work orders.

### Organisation Scope & Isolation:
- **Zero Client Trust**: The frontend is not a security boundary. Client-supplied organisation IDs or user roles in request bodies/headers are completely ignored.
- **Query Scoping**: Every API queryset is filtered by `request.user.organisation` at the base queryset level (`WorkOrder.objects.filter(organisation=request.user.organisation)`).
- **Lookup Verification**: Object retrieval uses `get_object_or_404(Model, id=id, organisation=request.user.organisation)` to return HTTP 404 (Not Found) rather than 403, preventing resource enumeration across tenants.
- **Cross-Org References**: When assigning a technician, the backend explicitly verifies `technician.organisation_id == request.user.organisation_id`.

## Transactions, idempotency and concurrency

### Scheduling Protection & Concurrency:
- Overlapping technician assignments are prevented using database transactions with row-level locking:
  ```python
  with transaction.atomic():
      overlapping = WorkOrder.objects.select_for_update().filter(
          organisation=user.organisation,
          technician_id=tech_id,
          scheduled_start__isnull=False,
          scheduled_end__isnull=False,
      ).exclude(id=wo.id).filter(
          scheduled_start__lt=new_end + buffer,
          scheduled_end__gt=new_start - buffer,
      )
      if overlapping.exists():
          return Response({"error": {"code": "conflict", ...}}, status=409)
  ```
- **Distributed Safety**: Why is this safe when multiple API instances run in parallel?
  PostgreSQL serializes concurrent transactions requesting `SELECT ... FOR UPDATE` for the same technician. Whichever API instance acquires the lock first checks availability and commits. The second instance waits on the row lock, then reads the committed assignment, detects the overlap conflict, and immediately returns HTTP 409 Conflict.
- Scheduling window validation enforces `scheduled_start < scheduled_end`.

### Idempotency & Progress-Event Handling:
- The progress-event API accepts client-supplied `eventId` idempotency keys.
- Under a `transaction.atomic()` block:
  1. The target work order is locked via `select_for_update()`.
  2. `ProgressEvent.objects.get_or_create(organisation=org, event_id=event_id, ...)` is called.
  3. If `created == False` (or on database `IntegrityError`), the endpoint safely returns the previously created event with status 200 and `"idempotentReplay": true`.
  4. If `created == True`, the status change is applied atomically, the immutable `raw_request` snapshot is persisted, and the audit log is recorded.
  5. Any validation failure triggers a full rollback, leaving no partial state or orphan events.

## Background jobs

### Notification Queue & Delivery Guarantees:
- Enqueued when a work order is assigned to a technician: `notify_technician_assignment.delay(str(wo.id), str(tech.id))`.
- **Deduplication**: Uses `NotificationAttempt` model with `UniqueConstraint(work_order, technician)`. If `status == "success"`, subsequent job invocations return `already_success` without contacting the provider.
- **Late Acknowledgement**: Celery task is configured with `acks_late=True` ensuring tasks are redelivered if a worker node crashes mid-execution.
- **Retry with Exponential Backoff**: Temporary failures trigger exponential backoff retry: `countdown = (2 ** retries) * 5` (5s, 10s, 20s, 40s, 80s) up to 5 retries.
- **Permanent Failure Handling**: Permanent errors (400 Bad Request / missing entity / invalid email) immediately record `status = "perm_fail"` in the audit record and do not retry.
- **Diagnostic Logging & Auditing**: Every attempt, success, temporary retry, and final failure is written to structured JSON logs and the `AuditLog` table.
- **Mock Provider Modes**: Controllable via `MOCK_PROVIDER_MODE` environment variable (`success`, `temp_fail`, `perm_fail`, `random`).

## Real-time updates

### Architecture & Protocol:
- Implemented using Django Channels over WebSockets (`ws/work-orders/?token=<JWT>`).
- Transport: WebSocket on ASGI server (Daphne), backed by Redis Channel Layer (`channels_redis`).

### Authentication & Tenant Isolation:
- On connection, the consumer extracts the JWT bearer token from query parameters or headers and verifies it via `rest_framework_simplejwt.tokens.AccessToken`.
- Connections without valid active tokens are closed immediately (`code=4401`).
- The WebSocket is joined exclusively to the organisation's isolated room: `f"org_{user.organisation_id}"`.
- Events are never published globally or across tenant channels.

### Client Reconnection & Graceful Degradation:
- The Next.js frontend client reconnects automatically with exponential backoff (1s, 2s, 4s, 8s, 15s) upon disconnection.
- If WebSockets are unavailable or blocked by network proxies, the frontend displays a `disconnected` badge while continuing full operation via standard REST API polling and manual refreshes.

## File security and storage limits

### Validation & Secure Storage:
- Allowed file types: Images (`image/jpeg`, `image/png`, `image/webp`) and PDFs (`application/pdf`).
- **Magic Bytes Validation**: File contents are inspected for binary signatures (`\x89PNG`, `\xff\xd8\xff`, `RIFF...WEBP`, `%PDF-`) preventing MIME-spoofing attacks.
- **Safe Identifiers**: User-provided filenames are never written to disk. Stored files are assigned random UUID filenames (`<uuid>.<ext>`), while `original_name` is stored separately in the database.
- **No Path Exposure**: Local filesystem paths are never returned in API responses. Downloads are served via authenticated streaming `FileResponse`.

### Quota Enforcement:
- Per-organisation storage limit is tracked via `Attachment.objects.filter(organisation=org).aggregate(Sum('size'))`.
- If `current_usage + file.size > organisation.storage_limit_bytes`, the backend rejects the upload with HTTP 400 (`"Organisation storage limit exceeded"`).

### Production Object-Storage Approach:
In production, local storage is replaced with AWS S3 using `django-storages[boto3]`:
- Set `DEFAULT_FILE_STORAGE = "storages.backends.s3boto3.S3Boto3Storage"`.
- Files stored in private S3 buckets partitioned by organisation ID (`s3://bucket/org_<id>/<uuid>.<ext>`).
- Download endpoint generates short-lived pre-signed URLs (`s3_client.generate_presigned_url('get_object', ...)`), ensuring direct, high-throughput downloads without proxying file bytes through API application servers.

## Security considerations

1. **BOLA / IDOR Protection**: Every database query, lookup, update, and deletion is scoped to `request.user.organisation`. Manipulating URLs or payload IDs cannot access or mutate another organisation's data.
2. **CSV Spreadsheet-Formula Injection Prevention**: In the CSV export endpoint, all cell values starting with formula control characters (`=`, `+`, `-`, `@`, `\t`, `\r`) are sanitized by prepending a single quote (`'`), neutralizing formula execution in spreadsheet software.
3. **Rate Limiting**: Cache-backed rate limiting protects authentication endpoints (5 req/min per IP) and progress-event submissions (30 req/min per user).
4. **Strict Input Sanitization**: Centralized DRF serializers validate date ranges, enum values, and payload structures before committing transactions.
5. **No Secrets in Source Control**: All credentials, secret keys, and database URLs are loaded from environment variables via `django-environ`.

## Production deployment and operations

### Deployment Strategy:
- **Containerization**: Separate Docker containers for API (Daphne), Worker (Celery), Web (Next.js), Database (PostgreSQL), and Cache/Broker (Redis).
- **Orchestration**: Deployable to AWS ECS (Fargate) or Kubernetes.
- **Database Migrations**: Executed as a Kubernetes pre-deployment Job or ECS release task prior to rolling out new API pods.

### Observability & Monitoring:
- **Correlation IDs**: `RequestIdMiddleware` assigns a unique `X-Request-ID` to every HTTP request and attaches it to response headers, error payloads, and log records.
- **Structured JSON Logging**: Logs formatted with timestamp, level, logger name, message, request ID, duration, and authenticated user identity for ingestion by Datadog / CloudWatch.
- **Probes**: `/health/` (liveness) and `/ready/` (readiness verifying database and cache connectivity).

### Backup & Disaster Recovery:
- PostgreSQL automated daily snapshots + continuous WAL archiving for Point-In-Time Recovery (PITR).
- S3 bucket versioning and Cross-Region Replication (CRR) for attachments.

## Assumptions and trade-offs

1. **Portable DB Concurrency vs ExclusionConstraint**: PostgreSQL `btree_gist` ExclusionConstraints provide database-level interval exclusion. To ensure full portability across test environments (including SQLite and PostgreSQL) while maintaining ironclad concurrency safety, we chose transaction-level `select_for_update()` row locking with interval queries, verified by concurrency unit tests.
2. **Local vs S3 Storage**: Local file storage with safe UUID naming and quota checks was implemented for local reproducibility without requiring AWS credentials, with a documented S3 production architecture.

## Known limitations or incomplete requirements

None. All requirements specified in the assessment brief are fully implemented, tested, and documented.
