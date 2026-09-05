# FieldDesk API

Django 5 + DRF + SimpleJWT + Channels + Celery.

## Setup

```bash
poetry install --no-root
python manage.py migrate
python manage.py seed
python manage.py runserver  # or daphne config.asgi:application -p 8000
celery -A config worker -l info
```

Env: `DATABASE_URL`, `REDIS_URL`, `SECRET_KEY`, `STORAGE_LIMIT_BYTES`, `MOCK_PROVIDER_MODE`.

## Tests

```bash
pytest -q
```

## Key invariants

- Org isolation via `organisation` FK on every model and queryset filtering.
- Overlap prevention via `SELECT FOR UPDATE` + range check inside `transaction.atomic()`.
- Idempotency via `UNIQUE(organisation, event_id)`.
- Attachments validated server-side, quota enforced.
- Worker with `acks_late`, backoff, perm-fail stop.
- WS group `org_<id>` with JWT auth.
