# FieldDesk — Multi-Tenant Field Service Platform

Full-stack production-grade implementation for the **FieldDesk Assessment**.

Built with **Django 5 + Django REST Framework + Channels (WebSockets) + Celery + PostgreSQL + Redis + Next.js 16 (React 19) + TypeScript + Tailwind CSS**.

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

- **Organisation Isolation**: Multi-tenant isolation enforced at the database and query layer. Queries are scoped to `request.user.organisation`; lookups use `get_object_or_404(..., organisation=...)` returning 404 to prevent resource enumeration. Client-supplied organisation/role fields are never trusted.
- **RBAC**: Backend-enforced role permissions for **Owner** (user and organisation management), **Dispatcher** (create, schedule, assign, and update work orders), and **Technician** (view assigned work and submit progress events).
- **Scheduling Concurrency**: Technician double-booking is prevented using `transaction.atomic()` with `SELECT ... FOR UPDATE` row-level locks and time-window queries (`scheduled_start < new_end AND scheduled_end > new_start`). Fully safe across $N$ distributed API replicas because PostgreSQL serializes lock acquisition.
- **Progress-Event Idempotency**: Atomic event handling with `UniqueConstraint(organisation, event_id)`. Simultaneous duplicate requests return HTTP 200 with `idempotentReplay: true` without double-mutating state. Original request payload is preserved in immutable `raw_request` audit records.
- **Secure File Storage & Quotas**: Backend validates file sizes (max 10MB) and binary magic bytes (`PNG`, `JPEG`, `WEBP`, `PDF`). Files are stored with random UUID filenames; original filenames and filesystem paths are never exposed. Organisation storage quotas are strictly enforced.
- **Asynchronous Background Processing**: Celery worker runs independently with `acks_late=True`, exponential backoff retry (`2^retry * 5s`), duplicate delivery prevention via `NotificationAttempt` unique constraints, and controllable mock provider simulation (`MOCK_PROVIDER_MODE`).
- **Real-time Updates**: Authenticated WebSockets via Django Channels and Redis channel layer. Broadcasts are isolated strictly to tenant channel groups (`org_<id>`). Client features automatic exponential backoff reconnection.
- **CSV Export & Formula Sanitization**: Memory-efficient streaming CSV exports with formula injection protection (neutralizing cells beginning with `=`, `+`, `-`, `@`, `\t`, `\r`).
- **Operational Quality**: Request correlation IDs (`X-Request-ID`), structured JSON logging, health checks (`/health/`, `/ready/`), and rate limiting.

---

## Quick Start (Docker Compose — Recommended)

```bash
# 1. Copy environment configuration
cp .env.example .env

# 2. Start PostgreSQL, Redis, Django API + Channels, Celery Worker, Next.js Web
docker compose up --build
```

- **Web Frontend**: [http://localhost:3000](http://localhost:3000)
- **API Backend**: [http://localhost:8000](http://localhost:8000)
- **Liveness Probe**: `curl http://localhost:8000/health/`
- **Readiness Probe**: `curl http://localhost:8000/ready/`

---

## Seed Data & Sample Credentials

Database migrations and seed data run automatically on startup. All sample accounts use password `Password123!`:

| Organisation | Username | Role | Password | Primary Capabilities |
| :--- | :--- | :--- | :--- | :--- |
| **Acme Field Co** | `acme_owner` | Owner | `Password123!` | Manage users & view all org work |
| **Acme Field Co** | `acme_dispatcher` | Dispatcher | `Password123!` | Create, schedule, assign work orders |
| **Acme Field Co** | `acme_technician` | Technician | `Password123!` | View assigned work & submit progress events |
| **Acme Field Co** | `acme_tech2` | Technician | `Password123!` | Secondary technician for scheduling tests |
| **Globex Maintenance** | `globex_owner` | Owner | `Password123!` | Manage users & view all org work |
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

# In a separate terminal, run Celery worker (requires Redis):
poetry run celery -A config worker -l info
```

### 2. Frontend Web
```bash
cd frontend
npm install --legacy-peer-deps
NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev
```

---

## Running Automated Tests

### Backend Test Suite (15 Test Cases)
```bash
cd backend
poetry run pytest -v
```
Covers authentication, RBAC, cross-org isolation, work order validation, concurrency conflicts, duplicate event idempotency, transaction rollback, attachment types/magic bytes/quotas, worker retries and duplicate delivery, CSV export formula injection and isolation, rate limiting, request correlation headers, and real-time WebSocket cross-org isolation.

### Frontend Test Suite (7 Test Cases), Linting, and Production Build
```bash
cd frontend
npm test             # Vitest test suite
npm run lint         # ESLint (0 errors, 0 warnings)
npm run build        # Production Next.js build
```

---

## API Summary

| Method | Path | Auth | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login/` | Public | Authenticate user & issue JWT tokens (rate limited) |
| `GET` | `/api/auth/me/` | JWT | Get current authenticated user profile & organisation |
| `GET/POST`| `/api/auth/users/` | Owner | List and create organisation users |
| `PATCH`| `/api/auth/users/<id>/` | Owner | Update user role (audited) |
| `GET/POST`| `/api/work-orders/` | JWT | List (search/filter/sort/paginate) & create work orders |
| `GET` | `/api/work-orders/stats/`| JWT | Summary counts for dashboard |
| `GET/PATCH`| `/api/work-orders/<id>/`| JWT | View work order details & edit |
| `POST` | `/api/work-orders/<id>/assign/` | Dispatcher/Owner | Assign technician with concurrency conflict check (409) |
| `GET` | `/api/work-orders/<id>/audit/` | JWT | Immutable activity and audit history |
| `POST` | `/api/work-orders/<id>/attachments/` | JWT | Upload attachment (magic byte & quota verified) |
| `GET` | `/api/work-orders/<id>/attachments/<att_id>/download/` | JWT | Download attachment safely |
| `POST` | `/api/events/` | JWT | Submit progress event (idempotent via `eventId`) |
| `GET` | `/api/exports/work-orders.csv` | JWT | Memory-efficient streaming CSV export |
| `WS` | `/ws/work-orders/?token=<JWT>` | JWT | Live real-time WebSocket connection |
| `GET` | `/health/` | Public | Liveness probe |
| `GET` | `/ready/` | Public | Readiness probe (database & cache health) |

---

## Submission Documentation

- Detailed technical decisions, database model, concurrency, background jobs, and operational considerations: [candidate-submission/TECHNICAL_NOTES.md](candidate-submission/TECHNICAL_NOTES.md)
- AI usage disclosure: [candidate-submission/AI_USAGE.md](candidate-submission/AI_USAGE.md)
- Assessment Brief: [docs/ASSESSMENT.md](docs/ASSESSMENT.md)
