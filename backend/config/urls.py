from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from django.conf import settings
from django.conf.urls.static import static
from django.db import connection

def health(request):
    return JsonResponse({"status": "ok"})

def readiness(request):
    # check db and redis
    try:
        with connection.cursor() as c:
            c.execute("SELECT 1")
    except Exception as e:
        return JsonResponse({"status": "not_ready", "error": str(e)}, status=503)
    # redis check optional
    try:
        from django.core.cache import cache
        cache.set("healthcheck", "1", timeout=5)
    except Exception:
        pass
    return JsonResponse({"status": "ready"})

urlpatterns = [
    path("admin/", admin.site.urls),
    path("health/", health, name="health"),
    path("ready/", readiness, name="readiness"),
    path("api/auth/", include("apps.accounts.urls")),
    path("api/work-orders/", include("apps.workorders.urls")),
    path("api/events/", include("apps.events.urls")),
    path("api/exports/", include("apps.exports.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
