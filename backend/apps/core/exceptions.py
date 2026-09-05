from rest_framework.views import exception_handler
from rest_framework.response import Response

def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)
    request = context.get("request")
    request_id = getattr(request, "request_id", None) if request else None
    if response is not None:
        # Normalize to {error:{code,message,details,requestId}}
        detail = response.data
        details = detail
        message = "Validation failed" if response.status_code == 400 else "Error"

        # DRF detail can be dict/list/string
        if isinstance(detail, dict):
            if "detail" in detail and len(detail) == 1:
                message = str(detail["detail"])
                details = None
            elif "non_field_errors" in detail and detail["non_field_errors"]:
                nfe = detail["non_field_errors"]
                message = nfe[0] if isinstance(nfe, (list, tuple)) and nfe else str(nfe)
            elif len(detail) > 0:
                first_key, first_val = next(iter(detail.items()))
                val_str = first_val[0] if isinstance(first_val, (list, tuple)) and first_val else str(first_val)
                clean_key = first_key.replace('_', ' ')
                message = f"{clean_key}: {val_str}" if clean_key != "non field errors" else val_str
        elif isinstance(detail, (list, tuple)) and len(detail) > 0:
            message = str(detail[0])
        elif isinstance(detail, str) and detail.strip():
            message = detail

        # Map status to code
        code_map = {400: "validation_error", 401: "unauthorized", 403: "forbidden", 404: "not_found", 409: "conflict", 429: "rate_limited"}
        code = code_map.get(response.status_code, "error")

        response.data = {
            "error": {
                "code": code,
                "message": message,
                "details": details,
                "requestId": request_id,
            }
        }
        # ensure header
        if request_id:
            response["X-Request-ID"] = request_id
    return response
