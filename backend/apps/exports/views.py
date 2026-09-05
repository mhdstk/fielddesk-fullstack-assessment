import csv
import io
from django.http import StreamingHttpResponse
from django.db.models import Q
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from apps.workorders.models import WorkOrder

def csv_sanitize(value):
    if value is None:
        return ""
    s = str(value)
    # prevent formula injection
    if s and s[0] in ("=", "+", "-", "@", "\t", "\r"):
        return "'" + s
    return s

def format_datetime_display(dt):
    if not dt:
        return ""
    try:
        from django.utils import timezone
        local = timezone.localtime(dt) if timezone.is_aware(dt) else dt
        # User readable: e.g. "Sep 02, 2026 10:30 AM"
        return local.strftime("%b %d, %Y %I:%M %p")
    except Exception:
        return str(dt)

PRIORITY_DISPLAY = {"low": "Low", "medium": "Medium", "high": "High", "urgent": "Urgent"}
STATUS_DISPLAY = {"draft": "Draft", "open": "Open", "scheduled": "Scheduled", "in_progress": "In Progress", "blocked": "Blocked", "completed": "Completed", "cancelled": "Cancelled"}

class Echo:
    def write(self, value):
        return value

class WorkOrderCSVExportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Apply same filters as list API
        qs = WorkOrder.objects.filter(organisation=request.user.organisation).select_related("technician", "creator").order_by("created_at")
        if request.user.role == "technician":
            qs = qs.filter(technician=request.user)

        params = request.query_params
        q = params.get("search") or params.get("q")
        if q:
            qs = qs.filter(Q(title__icontains=q) | Q(description__icontains=q) | Q(ref__icontains=q))
        status_f = params.get("status")
        if status_f:
            qs = qs.filter(status=status_f)
        priority = params.get("priority")
        if priority:
            qs = qs.filter(priority=priority)

        # Fetch queryset synchronously while still in the view's sync thread
        # (prevents SynchronousOnlyOperation when streaming under ASGI)
        # Using iterator for memory efficiency during fetch, then streaming from cached rows
        cached_rows = list(qs.iterator(chunk_size=2000))

        def row_generator():
            header = ["Ref", "Title", "Description", "Priority", "Status", "Technician", "Scheduled Start", "Scheduled End", "Site Name", "Creator", "Created At"]
            pseudo_buffer = Echo()
            writer = csv.writer(pseudo_buffer)
            yield writer.writerow([csv_sanitize(h) for h in header])
            for wo in cached_rows:
                row = [
                    csv_sanitize(wo.ref),
                    csv_sanitize(wo.title),
                    csv_sanitize(wo.description),
                    csv_sanitize(PRIORITY_DISPLAY.get(wo.priority, wo.priority)),
                    csv_sanitize(STATUS_DISPLAY.get(wo.status, wo.status)),
                    csv_sanitize(wo.technician.username if wo.technician else ""),
                    csv_sanitize(format_datetime_display(wo.scheduled_start)),
                    csv_sanitize(format_datetime_display(wo.scheduled_end)),
                    csv_sanitize(wo.site_name),
                    csv_sanitize(wo.creator.username if wo.creator else ""),
                    csv_sanitize(format_datetime_display(wo.created_at)),
                ]
                yield writer.writerow(row)

        response = StreamingHttpResponse(row_generator(), content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="work_orders.csv"'
        # prevent caching
        response["Cache-Control"] = "no-cache"
        return response
