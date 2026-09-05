import os

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

# Try Channels setup; fall back to plain Django ASGI if channels not installed
# This keeps `python manage.py runserver` working with both venv (channels 4) and
# system python (channels 3 or missing) and prevents ImproperlyConfigured on import.
try:
    from django.core.asgi import get_asgi_application
    from channels.routing import ProtocolTypeRouter, URLRouter
    from channels.security.websocket import AllowedHostsOriginValidator

    django_asgi_app = get_asgi_application()

    from apps.realtime.routing import websocket_urlpatterns

    application = ProtocolTypeRouter(
        {
            "http": django_asgi_app,
            "websocket": AllowedHostsOriginValidator(
                URLRouter(websocket_urlpatterns)
            ),
        }
    )
except Exception as exc:  # ImportError, ImproperlyConfigured, etc.
    # Fallback: plain Django ASGI (no websocket). Keeps check/runserver working
    # even when channels/daphne not installed.
    import logging

    logging.getLogger("apps.realtime").warning(
        "ASGI fallback to Django without Channels: %s", exc
    )
    from django.core.asgi import get_asgi_application

    application = get_asgi_application()
