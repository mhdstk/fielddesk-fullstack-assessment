import uuid
import logging
import time
from django.utils.deprecation import MiddlewareMixin

logger = logging.getLogger("apps.core")

class RequestIdMiddleware(MiddlewareMixin):
    def process_request(self, request):
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request.request_id = request_id

    def process_response(self, request, response):
        request_id = getattr(request, "request_id", str(uuid.uuid4()))
        response["X-Request-ID"] = request_id
        return response


class StructuredLoggingMiddleware(MiddlewareMixin):
    def process_request(self, request):
        request._start_time = time.time()

    def process_response(self, request, response):
        duration = time.time() - getattr(request, "_start_time", time.time())
        request_id = getattr(request, "request_id", "-")
        user = getattr(request, "user", None)
        user_str = str(user) if user and user.is_authenticated else "anon"
        logger.info(
            "request",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.get_full_path(),
                "status": response.status_code,
                "duration_ms": int(duration * 1000),
                "user": user_str,
            },
        )
        # also set correlation id for exception handler via header already
        return response
