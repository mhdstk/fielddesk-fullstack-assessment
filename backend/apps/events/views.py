from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status
from django.db import transaction, IntegrityError
from django.shortcuts import get_object_or_404
from django.utils import timezone
from .models import ProgressEvent
from apps.workorders.models import WorkOrder
from apps.audit.models import AuditLog
from django.core.cache import cache

ALLOWED_STATUSES = {"draft","open","scheduled","in_progress","blocked","completed","cancelled"}

class ProgressEventView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        # rate limit 30/m per user
        key = f"ratelimit:event:{request.user.id}"
        count = cache.get(key, 0)
        if count >= 30:
            return Response({"error": {"code": "rate_limited", "message": "Too many event submissions"}}, status=429)
        data = request.data
        # validate required fields present
        for field in ["eventId", "workOrderId", "type", "occurredAt", "payload"]:
            if field not in data:
                return Response({"error": {"code": "validation_error", "message": f"{field} required"}}, status=400)
        event_id = data["eventId"]
        work_order_id = data["workOrderId"]
        type_ = data["type"]
        occurred_at = data["occurredAt"]
        payload = data["payload"]

        # validate type
        valid_types = {c[0] for c in ProgressEvent.Type.choices}
        if type_ not in valid_types:
            return Response({"error": {"code": "validation_error", "message": f"Invalid event type {type_}"}}, status=400)
        # validate occurredAt parse
        from django.utils.dateparse import parse_datetime
        try:
            occ = parse_datetime(str(occurred_at))
            if occ is None:
                raise ValueError()
            if timezone.is_naive(occ):
                occ = timezone.make_aware(occ)
        except Exception:
            return Response({"error": {"code": "validation_error", "message": "Invalid occurredAt"}}, status=400)
        # occurredAt checks
        now = timezone.now()
        if occ > now + timezone.timedelta(minutes=5):
            return Response({"error": {"code": "validation_error", "message": "occurredAt cannot be in future"}}, status=400)
        # validate payload for status_changed
        if type_ == "status_changed":
            if not isinstance(payload, dict) or "status" not in payload:
                return Response({"error": {"code": "validation_error", "message": "payload.status required for status_changed"}}, status=400)
            if payload["status"] not in ALLOWED_STATUSES:
                return Response({"error": {"code": "validation_error", "message": f"Invalid status {payload['status']}"}}, status=400)

        # verify work order exists and belongs to org
        try:
            wo = WorkOrder.objects.get(id=work_order_id, organisation=request.user.organisation)
        except WorkOrder.DoesNotExist:
            return Response({"error": {"code": "not_found", "message": "Work order not found"}}, status=404)

        # verify user may act: technicians only on assigned, dispatcher/owner any in org
        if request.user.role == "technician" and wo.technician_id != request.user.id:
            return Response({"error": {"code": "forbidden", "message": "Not assigned to this work order"}}, status=403)

        # Restrict status transitions that require an assigned technician
        if type_ == "status_changed":
            new_status = payload.get("status")
            requires_tech = {"scheduled", "in_progress", "completed"}
            if new_status in requires_tech and wo.technician_id is None:
                return Response(
                    {"error": {"code": "validation_error", "message": f"Cannot move to '{new_status}' without an assigned technician. Assign a technician first."}},
                    status=400,
                )

        # idempotency + atomic processing
        # Preserve original request as raw_request
        raw = {
            "eventId": event_id,
            "workOrderId": str(work_order_id),
            "type": type_,
            "occurredAt": str(occurred_at),
            "payload": payload,
        }
        try:
            with transaction.atomic():
                # try to create event; unique constraint handles dup
                # Use select_for_update on work order to serialize updates
                wo_locked = WorkOrder.objects.select_for_update().get(id=wo.id)
                evt, created = ProgressEvent.objects.get_or_create(
                    organisation=request.user.organisation,
                    event_id=event_id,
                    defaults={
                        "work_order": wo_locked,
                        "type": type_,
                        "occurred_at": occ,
                        "payload": payload,
                        "created_by": request.user,
                        "raw_request": raw,
                    },
                )
                if not created:
                    # idempotent replay - return existing without re-applying
                    cache.set(key, count + 1, timeout=60)
                    return Response({
                        "id": str(evt.id),
                        "eventId": evt.event_id,
                        "workOrderId": str(evt.work_order_id),
                        "type": evt.type,
                        "occurredAt": evt.occurred_at.isoformat(),
                        "payload": evt.payload,
                        "created_at": evt.created_at.isoformat(),
                        "idempotentReplay": True,
                    }, status=200)

                # Apply work-order update atomically
                before_status = wo_locked.status
                if type_ == "status_changed":
                    new_status = payload["status"]
                    wo_locked.status = new_status
                    wo_locked.save(update_fields=["status", "updated_at"])
                    # audit
                    AuditLog.objects.create(
                        organisation=request.user.organisation,
                        actor=request.user,
                        action="status_changed",
                        target_type="work_order",
                        target_id=str(wo_locked.id),
                        before={"status": before_status},
                        after={"status": new_status, "event_id": event_id},
                        request_id=getattr(request, "request_id", None),
                    )
                else:
                    AuditLog.objects.create(
                        organisation=request.user.organisation,
                        actor=request.user,
                        action=f"event_{type_}",
                        target_type="work_order",
                        target_id=str(wo_locked.id),
                        after={"event_id": event_id, "payload": payload},
                        request_id=getattr(request, "request_id", None),
                    )
                # realtime
                try:
                    from channels.layers import get_channel_layer
                    from asgiref.sync import async_to_sync
                    layer = get_channel_layer()
                    async_to_sync(layer.group_send)(f"org_{request.user.organisation_id}", {"type": "work_order_update", "data": {"action": "event", "work_order_id": str(wo_locked.id), "event_id": event_id, "type": type_}})
                except Exception:
                    pass

                cache.set(key, count + 1, timeout=60)
                return Response({
                    "id": str(evt.id),
                    "eventId": evt.event_id,
                    "workOrderId": str(evt.work_order_id),
                    "type": evt.type,
                    "occurredAt": evt.occurred_at.isoformat(),
                    "payload": evt.payload,
                    "created_at": evt.created_at.isoformat(),
                    "idempotentReplay": False,
                }, status=201)
        except IntegrityError:
            # race on concurrent duplicate insert
            evt = ProgressEvent.objects.get(organisation=request.user.organisation, event_id=event_id)
            return Response({
                "id": str(evt.id),
                "eventId": evt.event_id,
                "workOrderId": str(evt.work_order_id),
                "type": evt.type,
                "occurredAt": evt.occurred_at.isoformat(),
                "payload": evt.payload,
                "created_at": evt.created_at.isoformat(),
                "idempotentReplay": True,
            }, status=200)
