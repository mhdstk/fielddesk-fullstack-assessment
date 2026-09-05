from pathlib import Path
import os
import environ

BASE_DIR = Path(__file__).resolve().parent.parent

env = environ.Env(
    DEBUG=(bool, True),
    SECRET_KEY=(str, "django-insecure-*qbern(sr+pb=dls60bq_oyz-lai!b_)i024m=ujj%q3xsn=r7"),
    DATABASE_URL=(str, ""),
    REDIS_URL=(str, "redis://localhost:6379/0"),
    ALLOWED_HOSTS=(str, "*"),
    CORS_ALLOWED_ORIGINS=(str, "http://localhost:3000,http://127.0.0.1:3000"),
    STORAGE_LIMIT_BYTES=(int, 104857600),  # 100 MB
)
# load .env if exists
env_file = BASE_DIR / ".env"
if env_file.exists():
    environ.Env.read_env(str(env_file))

SECRET_KEY = env("SECRET_KEY")
DEBUG = env("DEBUG")
ALLOWED_HOSTS = [h.strip() for h in env("ALLOWED_HOSTS").split(",") if h.strip()]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework_simplejwt",
    "corsheaders",
    "django_filters",
    "apps.accounts",
    "apps.workorders",
    "apps.events",
    "apps.audit",
    "apps.notifications",
    "apps.realtime",
    "apps.exports",
]

# Optional channels — add only if installed (allows runserver with system python that lacks channels)
try:
    import channels  # noqa

    INSTALLED_APPS.insert(6, "channels")
except ImportError:
    pass

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
]

# Optional whitenoise — if not installed (e.g. system python), skip gracefully
try:
    import whitenoise  # noqa

    MIDDLEWARE.append("whitenoise.middleware.WhiteNoiseMiddleware")
except ImportError:
    pass

MIDDLEWARE += [
    "apps.core.middleware.RequestIdMiddleware",
    "apps.core.middleware.StructuredLoggingMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# Database
if env("DATABASE_URL"):
    DATABASES = {"default": env.db()}
else:
    # fallback to sqlite for local dev without postgres, or use postgres if env set
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

# Override for postgres detection via DATABASE_URL containing postgres
# Channels layer
REDIS_URL = env("REDIS_URL")
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {"hosts": [REDIS_URL]},
    }
}
# Fallback to InMemory if redis not available (dev/tests)
try:
    import channels_redis  # noqa
except Exception:
    CHANNEL_LAYERS = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}

# Cache: try RedisCache (Django 4+), fallback to locmem if unavailable or during tests/checks
# This prevents InvalidCacheBackendError when running with system python that lacks RedisCache or django-redis
try:
    # Probe if RedisCache backend is importable in this Django install
    import importlib
    importlib.import_module("django.core.cache.backends.redis")
    _has_redis_cache = True
except ImportError:
    _has_redis_cache = False

if _has_redis_cache and "test" not in os.sys.argv and "check" not in os.sys.argv:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.redis.RedisCache",
            "LOCATION": REDIS_URL,
        }
    }
else:
    CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}

# Allow explicit override to force locmem when redis not running (e.g. local dev without docker)
if os.getenv("CACHE_BACKEND") == "locmem":
    CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}

# Celery
CELERY_BROKER_URL = REDIS_URL
CELERY_RESULT_BACKEND = REDIS_URL
CELERY_TASK_ALWAYS_EAGER = False
CELERY_TASK_EAGER_PROPAGATES = True

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# Use Argon2 if available
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.Argon2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"
STORAGE_LIMIT_BYTES = env("STORAGE_LIMIT_BYTES")

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# DRF
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "DEFAULT_FILTER_BACKENDS": ("django_filters.rest_framework.DjangoFilterBackend",),
    "DEFAULT_PAGINATION_CLASS": "apps.core.pagination.StandardPagination",
    "PAGE_SIZE": 20,
    "EXCEPTION_HANDLER": "apps.core.exceptions.custom_exception_handler",
}

from datetime import timedelta

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "AUTH_HEADER_TYPES": ("Bearer",),
}

CORS_ALLOWED_ORIGINS = [o.strip() for o in env("CORS_ALLOWED_ORIGINS").split(",") if o.strip()]
CORS_ALLOW_CREDENTIALS = True
# Allow custom header X-Request-ID (sent by frontend apiFetch) — otherwise preflight fails with CORS error
try:
    from corsheaders.defaults import default_headers  # type: ignore

    CORS_ALLOW_HEADERS = list(default_headers) + [
        "x-request-id",
        "X-Request-ID",
    ]
except ImportError:
    CORS_ALLOW_HEADERS = [
        "accept",
        "authorization",
        "content-type",
        "x-request-id",
        "X-Request-ID",
        "x-csrftoken",
        "x-requested-with",
    ]
CORS_EXPOSE_HEADERS = ["X-Request-ID", "Content-Disposition"]
CORS_ALLOW_METHODS = [
    "DELETE",
    "GET",
    "OPTIONS",
    "PATCH",
    "POST",
    "PUT",
]

# Logging - structured
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "json": {"()": "pythonjsonlogger.jsonlogger.JsonFormatter", "format": "%(asctime)s %(levelname)s %(name)s %(message)s %(request_id)s"}
    },
    "handlers": {
        "console": {"class": "logging.StreamHandler", "formatter": "json" if not DEBUG else None},
    },
    "root": {"handlers": ["console"], "level": "INFO"},
    "loggers": {
        "django": {"handlers": ["console"], "level": "INFO", "propagate": False},
        "apps": {"handlers": ["console"], "level": "DEBUG" if DEBUG else "INFO", "propagate": False},
    },
}
# fallback if pythonjsonlogger not installed
try:
    import pythonjsonlogger  # noqa
except ImportError:
    LOGGING["formatters"] = {}
    LOGGING["handlers"]["console"] = {"class": "logging.StreamHandler"}

# Rate limiting (simple cache based)
RATELIMIT_LOGIN = "5/m"
RATELIMIT_EVENT = "30/m"
