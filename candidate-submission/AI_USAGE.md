# AI usage disclosure

AI-assisted development tools are permitted for this assessment. Their use does not reduce the score by itself. Transparency, independent verification and understanding of the submitted work are required.

## Usage summary

| Tool and model, if known | Files, features or sections affected | Purpose of use | Nature of the output | How I reviewed or tested it |
| :--- | :--- | :--- | :--- | :--- |
| Google Antigravity (Gemini 3.7 Flash) | `backend/`, `frontend/`, `tests/`, `docker-compose.yml` | Full-stack architecture scaffolding, bug resolution, linting fixes, and comprehensive test authoring | Generated boilerplate, suggested transaction locking patterns, and wrote automated test suites | Manually reviewed every file, adjusted business logic, verified tenant isolation boundaries, and ran automated test pipelines |
| Google Antigravity (Gemini 3.7 Flash) | `frontend/src/` | Next.js 16 / React 19 ESLint and TypeScript type resolution | Suggested strict TypeScript interfaces and hook refactoring | Validated build, typecheck, and unit test execution across all routes |

## Details

### 1. What you asked the tool to help with:
- Implementing the multi-tenant architecture for FieldDesk across Django and Next.js.
- Designing concurrency-safe technician scheduling and idempotent event processing.
- Setting up Django Channels WebSocket broadcasting with organisation-level channel isolation.
- Resolving React 19 / Next.js 16 linting errors and writing Vitest test suites.

### 2. Which parts of the submission were generated or substantially modified:
- Backend models, serializers, views, and automated pytest suites.
- Frontend App Router components, API helpers, and unit tests.
- Docker Compose configuration and candidate submission documentation.

### 3. What you changed after receiving the output:
- Hardened attachment upload validation by adding magic-byte binary header inspection and safe UUID disk storage.
- Standardized the API error format and correlation ID propagation.
- Reinforced the scheduling overlap algorithm with buffer intervals.
- Eliminated all `any` types across the frontend codebase to achieve strict TypeScript type safety.

### 4. How you verified correctness, security and compatibility:
- Executed full backend automated test suite (`poetry run pytest`), passing all 15 test cases covering auth, roles, cross-org isolation, concurrency conflicts, idempotency, rollback, and storage quotas.
- Executed full frontend test suite (`npm test`), linting (`npm run lint`), and production build (`npm run build`).
- Inspected SQL queries and transaction boundaries for row-level locking.

### 5. Any output you rejected and why:
- Rejected relying solely on client-provided MIME headers for attachment uploads in favor of binary magic-byte verification.
- Rejected in-memory / cache-only locks for concurrency protection in favor of database transaction row locking (`SELECT FOR UPDATE`).

## Candidate confirmation

- [x] I have disclosed all AI-assisted work in this submission.
- [x] I personally reviewed every submitted file.
- [x] I can explain and modify every part of the implementation.
- [x] I independently ran the documented tests and checks.
- [x] I did not submit confidential or proprietary third-party material.

Candidate name: Shaheen TK

Date: September 5, 2026
