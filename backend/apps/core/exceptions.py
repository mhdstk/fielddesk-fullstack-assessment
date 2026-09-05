from rest_framework.views import exception_handler
from rest_framework.response import Response

def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)
    request = context.get("request")
    request_id = getattr(request, "request_id", None) if request else None
    if response is not None:
        # Normalize to {error:{code,message,details,requestId}}
        detail = response.data
        # DRF detail can be dict/list
        if isinstance(detail, dict) and "detail" in detail and len(detail) == 1:
            message = str(detail["detail"])
            details = None
        else:
            message = "Validation failed" if response.status_code == 400 else "Error"
            details = detail
        # Map status to code
        code_map = {400: "validation_error", 401: "unauthorized", 403: "forbidden", 404: "not_found", 409: "conflict", 429: "rate_limited"}
        code = code_map.get(response.status_code, "error")
        # Preserve original details for 400
        response.data = {
            "error": {
                "code": code,
                "message": message if message != "Validation failed" else "Validation failed",
                "details": details,
                "requestId": request_id,
            }
        }
        # ensure header
        if request_id:
            response["X-Request-ID"] = request_id
    return response
