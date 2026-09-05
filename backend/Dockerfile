FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends gcc libpq-dev && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml poetry.lock* /app/
RUN pip install --upgrade pip && pip install poetry && poetry config virtualenvs.create false && poetry install --no-root --only main || pip install django djangorestframework djangorestframework-simplejwt django-cors-headers django-filter psycopg2-binary redis celery channels channels-redis django-environ structlog argon2-cffi Pillow uvicorn daphne whitenoise gunicorn

COPY . /app

RUN mkdir -p /app/media /app/staticfiles

EXPOSE 8000
