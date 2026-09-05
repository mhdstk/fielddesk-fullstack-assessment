# FieldDesk — Multi-Tenant Field Service Platform

Full-stack production-grade implementation for the **FieldDesk Full-Stack Assessment**.

**Candidate:** Shaheen TK ([@mhdstk](https://github.com/mhdstk))  
**Branch:** `assessment/mhdstk`  
**Tech Stack:** Django 5.2 + DRF + Channels 4 (Daphne/WebSockets) + Celery 5.4 + PostgreSQL 16 + Redis 7 + Next.js 16 (React 19) + TypeScript + Tailwind CSS.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Repository Structure](#repository-structure)
- [Quick Start (Docker Compose)](#quick-start-docker-compose--recommended)
- [Seed Data & Sample Credentials](#seed-data--sample-credentials)
- [Local Development (Without Docker)](#local-development-without-docker)
- [Automated Tests & Quality Checks](#automated-tests--quality-checks)
- [API Reference](#api-reference)
- [Core Architectural Highlights](#core-architectural-highlights)
  - [Organisation Isolation & RBAC](#1-organisation-isolation--rbac)
  - [Scheduling Concurrency & Row Locking](#2-scheduling-concurrency--row-locking)
  - [Progress-Event Idempotency](#3-progress-event-idempotency)
  - [Secure Attachments & Storage Quotas](#4-secure-attachments--storage-quotas)
  - [Background Notifications & Mock Worker](#5-background-notifications--mock-worker)
  - [Tenant-Isolated Real-time WebSockets](#6-tenant-isolated-real-time-websockets)
  - [Streaming CSV Export & Formula Protection](#7-streaming-csv-export--formula-protection)
- [Scaling & Production Operations](#scaling--production-operations)
- [Submission Documents](#submission-documentation)

---

## Architecture Overview

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

---

## Repository Structure

```text
.
|-- backend/                     # Django 5 + DRF + Channels + Celery backend
|   |-- apps/
|   |   |-- accounts/            # Organisation, User, Auth, and Seed management
|   |   |-- audit/               # Immutable append-only audit logs
|   |   |-- core/                # RequestId middleware, custom error handler, pagination
|   |   |-- events/              # Idempotent progress events & atomic transitions
|   |   |-- exports/             # Streaming CSV exports with formula sanitization
|   |   |-- notifications/       # Celery tasks, retry logic, and mock providers
|   |   |-- realtime/            # Django Channels ASGI consumer and WebSocket routing
|   |   `-- workorders/          # Work order CRUD, attachments, scheduling concurrency
|   |-- config/                  # ASGI/WSGI entrypoints, Celery config, Django settings
|   |-- tests/                   # Pytest automated test suite (15 test cases)
|   |-- Dockerfile
|   |-- manage.py
|   |-- pyproject.toml
|   `-- poetry.lock
|-- frontend/                    # Next.js 16 (React 19) web application
|   |-- src/
|   |   |-- app/                 # Next.js App Router (Dashboard, Login, Work Orders, Users)
|   |   |-- components/          # Topbar (Live WebSocket indicator, user dropdown), Sidebar
|   |   |-- lib/                 # Typed API client, Auth context, TypeScript interfaces
|   |   `-- test/                # Vitest & React Testing Library test suite
|   |-- Dockerfile
|   |-- package.json
|   |-- tsconfig.json
|   `-- vitest.config.mts
|-- candidate-submission/
|   |-- AI_USAGE.md              # Transparent AI tool usage disclosure
|   `-- TECHNICAL_NOTES.md       # Comprehensive technical documentation & decisions
|-- docs/
|   |-- ASSESSMENT.md            # Assessment brief and requirements
|   |-- EVALUATION.md            # Evaluation criteria and scoring weights
|   `-- SUBMISSION.md            # Candidate submission instructions
|-- .env.example                 # Example environment configuration
|-- docker-compose.yml           # Multi-container orchestration (DB, Redis, API, Worker, Web)
`-- README.md                    # Project overview and local execution guide
```

---

## Quick Start (Docker Compose — Recommended)

```bash
# 1. Copy environment configuration
cp .env.example .env

# 2. Build and start all services (PostgreSQL, Redis, Django API + Channels, Celery Worker, Next.js Web)
docker compose up --build
```

### Access URLs:
- **Web Frontend**: [http://localhost:3000](http://localhost:3000)
- **API Backend**: [http://localhost:8000](http://localhost:8000)
- **Liveness Probe**: `curl http://localhost:8000/health/`
- **Readiness Probe**: `curl http://localhost:8000/ready/`

---

## Seed Data & Sample Credentials

Database migrations and initial seed data run automatically on startup. All sample accounts use password `Password123!`:

| Organisation | Username | Role | Password | Primary Capabilities |
| :--- | :--- | :--- | :--- | :--- |
| **Acme Field Co** | `acme_owner` | Owner | `Password123!` | Manage users, view & export all org work |
| **Acme Field Co** | `acme_dispatcher` | Dispatcher | `Password123!` | Create, schedule, assign work orders |
| **Acme Field Co** | `acme_technician` | Technician | `Password123!` | View assigned work & submit progress events |
| **Acme Field Co** | `acme_tech2` | Technician | `Password123!` | Secondary technician for scheduling tests |
| **Globex Maintenance** | `globex_owner` | Owner | `Password123!` | Manage users, view & export all org work |
| **Globex Maintenance** | `globex_dispatcher` | Dispatcher | `Password123!` | Create, schedule, assign work orders |
| **Globex Maintenance** | `globex_technician` | Technician | `Password123!` | View assigned work & submit progress events |
| **Globex Maintenance** | `globex_tech2` | Technician | `Password123!` | Secondary technician for Globex |

---

## Local Development (Without Docker)

### 1. Backend API & Worker
```bash
cd backend
poetry install --no-root
poetry run python manage.py migrate
poetry run python manage.py seed

# Run ASGI server with WebSocket support:
poetry run daphne -b 127.0.0.1 -p 8000 config.asgi:application

# In a separate terminal, run Celery worker (requires Redis on port 6379):
poetry run celery -A config worker -l info
```

### 2. Frontend Web Application
```bash
cd frontend
npm install --legacy-peer-deps
NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev
```

---

## Automated Tests & Quality Checks

### Verification Summary:
| Check | Command | Result |
| :--- | :--- | :--- |
| **Backend Tests** | `cd backend && poetry run pytest -v` | **15 passed** (100% pass) |
| **Frontend Tests** | `cd frontend && npm test` | **9 passed** (100% pass) |
| **Frontend Lint** | `cd frontend && npm run lint` | **0 errors, 0 warnings** |
| **Frontend Build** | `cd frontend && npm run build` | **Compiled successfully** (Next.js Turbopack) |

### 1. Backend Pytest Suite (15 Test Cases)
```bash
cd backend
poetry run pytest -v
```
**Coverage:**
- Authentication & JWT token issuance (valid & invalid credentials).
- Role-based access control (RBAC) restrictions across all roles.
- Cross-organisation isolation (URL ID tampering returns 404).
- Real-time WebSocket cross-organisation isolation (group `org_<id>`).
- Work order input validation & date window logic.
- Concurrent scheduling conflict detection with row-level locks (409 Conflict).
- Duplicate event idempotency (`eventId` key, `idempotentReplay: true`).
- Transaction rollback on event validation failure.
- Attachment magic bytes inspection, size limits, and org quota enforcement.
- Celery worker exponential backoff retries and duplicate notification prevention.
- Streaming CSV export with spreadsheet formula injection protection.
- Rate limiting on auth and event endpoints.
- Request correlation ID (`X-Request-ID`) propagation.

### 2. Frontend Vitest Suite (9 Test Cases)
```bash
cd frontend
npm test
```
**Coverage:**
- Full login workflow and sample account credential auto-fill.
- Navigation and organisation scope badge in Topbar.
- Concurrency conflict handling and detailed API error extraction.
- Toaster notification system and validation error messages (e.g. `scheduled_end must be after scheduled_start`).
- Progress event idempotency and auth token local storage handling.
- Real-time WebSocket connectivity status indicator.

---

## API Reference

| Method | Path | Auth | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login/` | Public | Authenticate user & issue JWT tokens (rate limited: 5 req/min) |
| `GET` | `/api/auth/me/` | JWT | Get current authenticated user profile & organisation |
| `GET/POST`| `/api/auth/users/` | Owner | List and create organisation users |
| `PATCH`| `/api/auth/users/<id>/` | Owner | Update user role (audited) |
| `GET/POST`| `/api/work-orders/` | JWT | List (search/filter/sort/paginate) & create work orders |
| `GET` | `/api/work-orders/stats/`| JWT | Summary counts for dashboard |
| `GET/PATCH`| `/api/work-orders/<id>/`| JWT | View work order details & edit |
| `POST` | `/api/work-orders/<id>/assign/` | Dispatcher/Owner | Assign technician with concurrency conflict check (409) |
| `GET` | `/api/work-orders/<id>/audit/` | JWT | Immutable activity and audit history |
| `POST` | `/api/work-orders/<id>/attachments/` | JWT | Upload attachment (magic byte & quota verified) |
| `GET` | `/api/work-orders/<id>/attachments/<att_id>/download/` | JWT | Download attachment safely via streaming response |
| `POST` | `/api/events/` | JWT | Submit progress event (idempotent via `eventId`) |
| `GET` | `/api/exports/work-orders.csv` | JWT | Memory-efficient streaming CSV export |
| `WS` | `/ws/work-orders/?token=<JWT>` | JWT | Live real-time WebSocket connection |
| `GET` | `/health/` | Public | Liveness probe (HTTP 200 `{"status": "ok"}`) |
| `GET` | `/ready/` | Public | Readiness probe (verifies database & Redis connectivity) |

---

## Core Architectural Highlights

### 1. Organisation Isolation & RBAC
- **Zero Client Trust**: Client-supplied organisation or role fields in request bodies or query parameters are completely ignored.
- **Database Queryset Scoping**: All querysets are automatically scoped to `request.user.organisation` at the base ORM layer.
- **404 Over 403 on Cross-Org Access**: Lookups use `get_object_or_404(..., organisation=request.user.organisation)`, preventing resource enumeration attacks across tenants.
- **Strict Role Boundaries**:
  - **Owner**: Full organisation administration, user creation, role assignment.
  - **Dispatcher**: Create, schedule, assign work orders, upload attachments, export reports.
  - **Technician**: View assigned work only, submit progress events, upload attachments for assigned work orders.

### 2. Scheduling Concurrency & Row Locking
- When assigning a technician, an atomic database transaction acquires a `SELECT ... FOR UPDATE` row lock on existing scheduled work orders for that technician:
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
          return Response({"error": {"code": "conflict", "message": "Technician has a scheduling conflict."}}, status=409)
  ```
- **Distributed Safety**: Safe across $N$ API server instances because PostgreSQL serializes lock acquisition. If two dispatchers attempt conflicting assignments simultaneously, the second transaction waits for lock release, evaluates the updated state, detects the conflict, and returns HTTP 409 Conflict.

### 3. Progress-Event Idempotency
- Technicians submit progress events with client-generated `eventId` UUIDs.
- Handled inside `transaction.atomic()` with `ProgressEvent.objects.get_or_create(organisation=org, event_id=event_id, ...)`:
  - If already processed: Returns HTTP 200 with `"idempotentReplay": true` without re-applying state changes.
  - If new: Atomically updates work order status, persists an immutable `raw_request` snapshot for audit compliance, and creates an audit log entry.
  - Failures trigger an immediate rollback, preventing orphaned event records.

### 4. Secure Attachments & Storage Quotas
- Supported types: Images (`image/png`, `image/jpeg`, `image/webp`) and PDFs (`application/pdf`). Max size: 10MB.
- **Binary Magic-Byte Inspection**: Validates file headers (`\x89PNG`, `\xff\xd8\xff`, `RIFF...WEBP`, `%PDF-`), preventing MIME-spoofing attacks.
- **Safe UUID Storage**: Uploaded files are stored with random UUID filenames (`<uuid>.<ext>`) to prevent directory traversal and file overwrite attacks.
- **Quota Tracking**: Organisation storage usage is aggregated dynamically; uploads exceeding `storage_limit_bytes` are rejected with HTTP 400.

### 5. Background Notifications & Mock Worker
- Celery worker consumes `notify_technician_assignment` tasks independently of the HTTP cycle.
- **Deduplication**: `NotificationAttempt` model with `UniqueConstraint(work_order, technician)` prevents duplicate deliveries.
- **Exponential Backoff**: Temporary failures retry automatically with exponential backoff (`2^retry * 5s`).
- **Mock Provider Simulation**: Controllable via `MOCK_PROVIDER_MODE` environment variable (`success`, `temp_fail`, `perm_fail`, `random`).

### 6. Tenant-Isolated Real-time WebSockets
- Django Channels ASGI consumer authenticated via SimpleJWT `AccessToken`.
- Sockets join strictly isolated channel groups: `org_<organisation_id>`.
- Work order changes broadcast live mutations (created, updated, assigned, status changed) to connected clients in real-time.
- Next.js client features automatic exponential backoff reconnection.

### 7. Streaming CSV Export & Formula Protection
- Generates CSV exports via memory-efficient Django `StreamingHttpResponse`.
- **Formula Injection Defense**: Neutralizes spreadsheet formula execution by prepending a single quote (`'`) to any cell starting with `=`, `+`, `-`, `@`, `\t`, or `\r`.

---

## Scaling & Production Operations

- **Horizontal API Scaling**: The API is 100% stateless with JWT authentication. Multiple Daphne API instances can run behind an AWS ALB or Kubernetes Ingress.
- **Worker Scaling**: Celery worker pods scale horizontally based on queue depth metrics.
- **Production S3 Storage**: Local file storage can be swapped for AWS S3 using `django-storages[boto3]` with private bucket partitioning (`s3://bucket/org_<id>/<uuid>.<ext>`) and pre-signed download URLs.
- **Database Connection Pooling**: Deploy PgBouncer in front of PostgreSQL for transaction-level connection pooling under high concurrency.
- **Observability**: `RequestIdMiddleware` injects `X-Request-ID` correlation IDs across all logs, responses, and error payloads. Structured JSON logging integrates with Datadog and AWS CloudWatch.
- **Disaster Recovery**: Automated daily PostgreSQL snapshots, WAL archiving for Point-In-Time Recovery (PITR), and S3 cross-region replication.

---

## Submission Documentation

- Technical Notes & Decisions: [candidate-submission/TECHNICAL_NOTES.md](candidate-submission/TECHNICAL_NOTES.md)
- AI Usage Disclosure: [candidate-submission/AI_USAGE.md](candidate-submission/AI_USAGE.md)
- Assessment Brief: [docs/ASSESSMENT.md](docs/ASSESSMENT.md)
- Evaluation Criteria: [docs/EVALUATION.md](docs/EVALUATION.md)
- Submission Instructions: [docs/SUBMISSION.md](docs/SUBMISSION.md)
