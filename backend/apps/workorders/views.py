from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.decorators import api_view, permission_classes
from django.db import transaction, IntegrityError
from django.db.models import Q, Count
from django.shortcuts import get_object_or_404
from django.utils import timezone
from datetime import timedelta
from .models import WorkOrder, Attachment
from .serializers import WorkOrderSerializer, AssignSerializer
from apps.audit.models import AuditLog
from apps.notifications.tasks import notify_technician_assignment
from django.conf import settings
from django.core.files.storage import default_storage
from django.http import FileResponse, Http404
import uuid
import mimetypes
import os

class WorkOrderListCreateView(generics.ListCreateAPIView):
    serializer_class = WorkOrderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = WorkOrder.objects.filter(organisation=user.organisation).select_related("technician", "creator", "organisation").prefetch_related("attachments").order_by("-created_at")
        # Technician isolation: technicians only see work assigned to them (per spec)
        # Owner/dispatcher see all org work orders; technician filtered unless explicitly querying (which still restricted)
        if user.role == "technician":
            qs = qs.filter(technician=user)
        params = self.request.query_params
        # search
        q = params.get("search") or params.get("q")
        if q:
            qs = qs.filter(Q(title__icontains=q) | Q(description__icontains=q) | Q(ref__icontains=q) | Q(site_name__icontains=q))
        # filters
        status_f = params.get("status")
        if status_f:
            qs = qs.filter(status=status_f)
        priority = params.get("priority")
        if priority:
            qs = qs.filter(priority=priority)
        # allow explicit technician filter only for non-technicians (dispatcher/owner can filter by tech)
        # technicians already restricted to self, ignore any technician param to prevent bypass
        if user.role != "technician":
            technician = params.get("technician") or params.get("technician_id")
            if technician:
                qs = qs.filter(technician_id=technician)
        site = params.get("site_name")
        if site:
            qs = qs.filter(site_name__icontains=site)
        # sorting
        sort = params.get("sort") or params.get("ordering")
        allowed_sorts = {"created_at", "-created_at", "scheduled_start", "-scheduled_start", "priority", "-priority", "title", "-title", "ref", "-ref", "status", "-status"}
        if sort in allowed_sorts:
            qs = qs.order_by(sort)
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        if user.role == "technician":
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Technicians cannot create work orders")
        # generate ref safely inside transaction
        with transaction.atomic():
            # org isolation already
            org = user.organisation
            wo = serializer.save(organisation=org, creator=user)
            # ensure ref uniqueness retry if needed (save already set ref)
            # if IntegrityError on ref, generate new
            AuditLog.objects.create(
                organisation=org,
                actor=user,
                action="work_order_created",
                target_type="work_order",
                target_id=str(wo.id),
                after={"title": wo.title, "status": wo.status},
                request_id=getattr(self.request, "request_id", None),
            )
            # realtime broadcast
            try:
                from channels.layers import get_channel_layer
                from asgiref.sync import async_to_sync
                layer = get_channel_layer()
                async_to_sync(layer.group_send)(f"org_{org.id}", {"type": "work_order_update", "data": {"action": "created", "work_order_id": str(wo.id), "ref": wo.ref}})
            except Exception:
                pass


class WorkOrderDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = WorkOrderSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = "id"

    def get_queryset(self):
        return WorkOrder.objects.filter(organisation=self.request.user.organisation).select_related("technician", "creator").prefetch_related("attachments")

    def get_object(self):
        obj = super().get_object()
        # technicians can only view assigned or created? Spec says views assigned work. Allow view if assigned or if not technician
        user = self.request.user
        if user.role == "technician":
            # allow view if assigned to them or if status check? For now allow any in org but filter list? Keep strict: view only assigned
            # But to avoid blocking, allow viewing assigned only; others 404
            if obj.technician_id != user.id and obj.creator_id != user.id:
                # check if there are any work orders assigned to technician - allow viewing only assigned for technicians per spec
                # Return 404 to avoid leaking existence
                from rest_framework.exceptions import NotFound
                raise NotFound("Work order not found")
        return obj

    def perform_update(self, serializer):
        user = self.request.user
        if user.role == "technician":
            # technicians can only submit progress via events, not edit work order directly
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Technicians cannot edit work orders directly")
        wo = self.get_object()
        before = {"status": wo.status, "technician_id": str(wo.technician_id) if wo.technician_id else None, "title": wo.title}
        # capture technician change for overlap check
        tech_id = serializer.validated_data.get("technician_id")
        start = serializer.validated_data.get("scheduled_start", wo.scheduled_start)
        end = serializer.validated_data.get("scheduled_end", wo.scheduled_end)
        # if technician provided, validate org and role
        if "technician_id" in serializer.validated_data and tech_id is not None:
            from apps.accounts.models import User
            try:
                tech = User.objects.get(id=tech_id, organisation=user.organisation)
            except User.DoesNotExist:
                raise serializers.ValidationError({"technician_id": "Technician not found in organisation"})
            if tech.role != "technician":
                raise serializers.ValidationError({"technician_id": "Not a technician"})
        # overlap check if technician assigned and scheduling present
        effective_tech_id = tech_id if "technician_id" in serializer.validated_data else wo.technician_id
        effective_start = start
        effective_end = end
        if effective_tech_id and effective_start and effective_end:
            with transaction.atomic():
                # 1 hour buffer + same-day gap: worker cannot be assigned within 1 hr on same day
                buffer = timedelta(hours=1)
                overlapping = WorkOrder.objects.select_for_update().filter(
                    organisation=user.organisation,
                    technician_id=effective_tech_id,
                    scheduled_start__isnull=False,
                    scheduled_end__isnull=False,
                    scheduled_start__date=effective_start.date(),
                ).exclude(id=wo.id).filter(
                    scheduled_start__lt=effective_end + buffer,
                    scheduled_end__gt=effective_start - buffer,
                )
                # also check exact overlap without date restriction (covers multi-day / buffer)
                if not overlapping.exists():
                    overlapping = WorkOrder.objects.select_for_update().filter(
                        organisation=user.organisation,
                        technician_id=effective_tech_id,
                        scheduled_start__isnull=False,
                        scheduled_end__isnull=False,
                    ).exclude(id=wo.id).filter(
                        scheduled_start__lt=effective_end,
                        scheduled_end__gt=effective_start,
                    )
                if overlapping.exists():
                    conflict = overlapping.first()
                    from rest_framework.exceptions import ValidationError as DRFValidationError
                    raise DRFValidationError({"non_field_errors": [f"This worker is already assigned to {conflict.ref} on {conflict.scheduled_start.date()} between {conflict.scheduled_start.strftime('%H:%M')}–{conflict.scheduled_end.strftime('%H:%M')} (1 hr gap required)"]})

        # handle concurrency on overlapping assign as above, then save
        with transaction.atomic():
            updated = serializer.save()
            after = {"status": updated.status, "technician_id": str(updated.technician_id) if updated.technician_id else None, "title": updated.title}
            # audit
            if before != after:
                if before["technician_id"] != after["technician_id"]:
                    AuditLog.objects.create(organisation=user.organisation, actor=user, action="assignment_changed", target_type="work_order", target_id=str(updated.id), before=before, after=after, request_id=getattr(self.request, "request_id", None))
                elif before["status"] != after["status"]:
                    AuditLog.objects.create(organisation=user.organisation, actor=user, action="status_changed", target_type="work_order", target_id=str(updated.id), before=before, after=after, request_id=getattr(self.request, "request_id", None))
                else:
                    AuditLog.objects.create(organisation=user.organisation, actor=user, action="work_order_updated", target_type="work_order", target_id=str(updated.id), before=before, after=after, request_id=getattr(self.request, "request_id", None))
            # realtime
            try:
                from channels.layers import get_channel_layer
                from asgiref.sync import async_to_sync
                layer = get_channel_layer()
                async_to_sync(layer.group_send)(f"org_{user.organisation_id}", {"type": "work_order_update", "data": {"action": "updated", "work_order_id": str(updated.id), "ref": updated.ref}})
            except Exception:
                pass


class AssignView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, id):
        if request.user.role == "technician":
            return Response({"error": {"code": "forbidden", "message": "Technicians cannot assign", "requestId": getattr(request, "request_id", None)}}, status=403)
        wo = get_object_or_404(WorkOrder, id=id, organisation=request.user.organisation)
        ser = AssignSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        tech_id = ser.validated_data["technician_id"]
        s = ser.validated_data.get("scheduled_start")
        e = ser.validated_data.get("scheduled_end")
        # if not provided, use existing wo scheduling or now+2h window?
        if s is None:
            s = wo.scheduled_start
        if e is None:
            e = wo.scheduled_end
        if s and e and e <= s:
            return Response({"error": {"code": "validation_error", "message": "scheduled_end must be after scheduled_start"}}, status=400)
        # validate technician
        from apps.accounts.models import User
        try:
            tech = User.objects.get(id=tech_id, organisation=request.user.organisation, role="technician")
        except User.DoesNotExist:
            return Response({"error": {"code": "not_found", "message": "Technician not found"}}, status=404)
        # concurrency-safe check inside transaction with select_for_update
        # 1 hour gap on same day: worker cannot be assigned within 1 hr on same day
        buffer = timedelta(hours=1)
        try:
            with transaction.atomic():
                # lock rows for this technician to serialize
                # note: select_for_update only works inside transaction
                if s and e:
                    # same-day 1hr-gap check
                    overlapping = WorkOrder.objects.select_for_update().filter(
                        organisation=request.user.organisation,
                        technician_id=tech.id,
                        scheduled_start__isnull=False,
                        scheduled_end__isnull=False,
                        scheduled_start__date=s.date(),
                    ).exclude(id=wo.id).filter(scheduled_start__lt=e + buffer, scheduled_end__gt=s - buffer)
                    if not overlapping.exists():
                        # exact overlap (covers cross-day edge)
                        overlapping = WorkOrder.objects.select_for_update().filter(
                            organisation=request.user.organisation,
                            technician_id=tech.id,
                            scheduled_start__isnull=False,
                            scheduled_end__isnull=False,
                        ).exclude(id=wo.id).filter(scheduled_start__lt=e, scheduled_end__gt=s)
                    if overlapping.exists():
                        conflict = overlapping.first()
                        return Response({"error": {"code": "conflict", "message": f"This worker is already assigned to {conflict.ref} on {conflict.scheduled_start.date()} between {conflict.scheduled_start.strftime('%H:%M')}–{conflict.scheduled_end.strftime('%H:%M')} (1 hour gap required on same day)", "details": {"technician_id": str(tech.id), "conflicting_work_order": str(conflict.id), "ref": conflict.ref, "scheduled_start": conflict.scheduled_start.isoformat(), "scheduled_end": conflict.scheduled_end.isoformat()}}}, status=409)
                # update
                before = {"technician_id": str(wo.technician_id) if wo.technician_id else None, "scheduled_start": str(wo.scheduled_start) if wo.scheduled_start else None}
                wo.technician = tech
                if s:
                    wo.scheduled_start = s
                if e:
                    wo.scheduled_end = e
                # if status was open/draft, move to scheduled
                if wo.status in ("open", "draft"):
                    wo.status = "scheduled"
                wo.save()
                AuditLog.objects.create(
                    organisation=request.user.organisation,
                    actor=request.user,
                    action="assignment_changed",
                    target_type="work_order",
                    target_id=str(wo.id),
                    before=before,
                    after={"technician_id": str(tech.id), "scheduled_start": str(wo.scheduled_start), "scheduled_end": str(wo.scheduled_end)},
                    request_id=getattr(request, "request_id", None),
                )
                # enqueue notification job
                try:
                    notify_technician_assignment.delay(str(wo.id), str(tech.id))
                except Exception:
                    # if celery not available (e.g. eager or redis down), log but don't fail request
                    pass
                # realtime
                try:
                    from channels.layers import get_channel_layer
                    from asgiref.sync import async_to_sync
                    layer = get_channel_layer()
                    async_to_sync(layer.group_send)(f"org_{request.user.organisation_id}", {"type": "work_order_update", "data": {"action": "assigned", "work_order_id": str(wo.id), "technician_id": str(tech.id)}})
                except Exception:
                    pass
                return Response(WorkOrderSerializer(wo).data)
        except IntegrityError as ex:
            return Response({"error": {"code": "conflict", "message": "Concurrent update conflict"}}, status=409)


class DashboardView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request):
        org = request.user.organisation
        qs = WorkOrder.objects.filter(organisation=org)
        if request.user.role == "technician":
            qs = qs.filter(technician=request.user)
        total = qs.count()
        by_status = qs.values("status").annotate(count=Count("id"))
        by_priority = qs.values("priority").annotate(count=Count("id"))
        my_assigned = qs.filter(technician=request.user).count() if request.user.role == "technician" else None
        return Response({
            "total": total,
            "by_status": {x["status"]: x["count"] for x in by_status},
            "by_priority": {x["priority"]: x["count"] for x in by_priority},
            "my_assigned": my_assigned,
        })

class AuditListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = __import__("apps.audit.serializers", fromlist=["AuditLogSerializer"]).AuditLogSerializer

    def get_queryset(self):
        wo_id = self.kwargs["id"]
        # ensure work order belongs to org
        get_object_or_404(WorkOrder, id=wo_id, organisation=self.request.user.organisation)
        return __import__("apps.audit.models", fromlist=["AuditLog"]).AuditLog.objects.filter(organisation=self.request.user.organisation, target_type="work_order", target_id=str(wo_id)).select_related("actor").order_by("-timestamp")

def is_valid_magic_bytes(file_obj, mime_type):
    try:
        pos = file_obj.tell() if hasattr(file_obj, "tell") else 0
        header = file_obj.read(32)
        if hasattr(file_obj, "seek"):
            file_obj.seek(pos)
        if not header:
            return False
        if header.startswith(b"\x89PNG\r\n\x1a\n"):
            return mime_type == "image/png"
        elif header.startswith(b"\xff\xd8\xff"):
            return mime_type in ("image/jpeg", "image/jpg")
        elif header.startswith(b"RIFF") and b"WEBP" in header[:16]:
            return mime_type == "image/webp"
        elif header.startswith(b"%PDF-"):
            return mime_type == "application/pdf"
        return False
    except Exception:
        return False

# Attachments
class AttachmentUploadView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request, id):
        wo = get_object_or_404(WorkOrder, id=id, organisation=request.user.organisation)
        if request.user.role == "technician" and wo.technician_id != request.user.id:
            # technicians can only attach to assigned work
            return Response({"error": {"code": "forbidden", "message": "Not assigned to this work order"}}, status=403)
        files = request.FILES.getlist("file") or ([request.FILES["file"]] if "file" in request.FILES else [])
        if not files or files[0] is None:
            return Response({"error": {"code": "validation_error", "message": "No file provided"}}, status=400)
        allowed_mimes = {"image/jpeg", "image/png", "image/webp", "application/pdf"}
        max_size = 10 * 1024 * 1024
        # quota check
        from django.db.models import Sum
        current_usage = Attachment.objects.filter(organisation=request.user.organisation).aggregate(s=Sum("size"))["s"] or 0
        org_limit = request.user.organisation.storage_limit_bytes
        results = []
        for f in files:
            # mime check via content_type + size
            if f.size > max_size:
                return Response({"error": {"code": "validation_error", "message": f"File {f.name} exceeds 10MB"}}, status=400)
            mime = f.content_type
            if mime not in allowed_mimes:
                # try guess by extension fallback
                guessed, _ = mimetypes.guess_type(f.name)
                if guessed not in allowed_mimes:
                    return Response({"error": {"code": "validation_error", "message": f"File type {mime} not allowed"}}, status=400)
                mime = guessed

            # Magic bytes validation
            if not is_valid_magic_bytes(f, mime):
                return Response({"error": {"code": "validation_error", "message": f"File content does not match declared type {mime}"}}, status=400)

            if current_usage + f.size > org_limit:
                return Response({"error": {"code": "validation_error", "message": "Organisation storage limit exceeded"}}, status=400)

            # safe storage identifier: UUID + sanitized extension
            original_display_name = f.name
            ext = os.path.splitext(f.name)[1].lower()[:10]
            if not ext or ext not in {".png", ".jpg", ".jpeg", ".webp", ".pdf"}:
                ext_map = {"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "application/pdf": ".pdf"}
                ext = ext_map.get(mime, ".bin")
            safe_name = f"{uuid.uuid4().hex}{ext}"
            f.name = safe_name

            # save via model
            with transaction.atomic():
                att = Attachment.objects.create(
                    organisation=request.user.organisation,
                    work_order=wo,
                    file=f,
                    original_name=original_display_name,
                    mime_type=mime,
                    size=f.size,
                    uploaded_by=request.user,
                )
                current_usage += f.size
                AuditLog.objects.create(
                    organisation=request.user.organisation,
                    actor=request.user,
                    action="attachment_added",
                    target_type="work_order",
                    target_id=str(wo.id),
                    after={"attachment_id": str(att.id), "original_name": original_display_name, "size": f.size},
                    request_id=getattr(request, "request_id", None),
                )
                results.append(att)
        from .serializers import AttachmentSerializer
        return Response(AttachmentSerializer(results, many=True).data, status=201)

class AttachmentDownloadView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request, id, attachment_id):
        wo = get_object_or_404(WorkOrder, id=id, organisation=request.user.organisation)
        att = get_object_or_404(Attachment, id=attachment_id, work_order=wo, organisation=request.user.organisation)
        # do not expose local path
        try:
            return FileResponse(att.file.open("rb"), content_type=att.mime_type, as_attachment=True, filename=att.original_name)
        except FileNotFoundError:
            raise Http404("File not found")
