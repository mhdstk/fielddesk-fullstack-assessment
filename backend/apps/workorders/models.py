import uuid
from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError

class WorkOrder(models.Model):
    class Priority(models.TextChoices):
        LOW = "low", "Low"
        MEDIUM = "medium", "Medium"
        HIGH = "high", "High"
        URGENT = "urgent", "Urgent"

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        OPEN = "open", "Open"
        SCHEDULED = "scheduled", "Scheduled"
        IN_PROGRESS = "in_progress", "In Progress"
        BLOCKED = "blocked", "Blocked"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organisation = models.ForeignKey("accounts.Organisation", on_delete=models.CASCADE, related_name="work_orders")
    ref = models.CharField(max_length=20, editable=False)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    priority = models.CharField(max_length=20, choices=Priority.choices, default=Priority.MEDIUM)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN)
    technician = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="assigned_work_orders")
    scheduled_start = models.DateTimeField(null=True, blank=True)
    scheduled_end = models.DateTimeField(null=True, blank=True)
    site_name = models.CharField(max_length=255, blank=True)
    creator = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="created_work_orders")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["organisation", "ref"], name="uniq_org_ref"),
        ]
        indexes = [
            models.Index(fields=["organisation", "status"]),
            models.Index(fields=["organisation", "technician", "scheduled_start"]),
            models.Index(fields=["organisation", "created_at"]),
        ]

    def clean(self):
        if self.scheduled_start and self.scheduled_end:
            if self.scheduled_end <= self.scheduled_start:
                raise ValidationError("Scheduled end time must be after scheduled start time.")
        if self.technician and self.technician.organisation_id != self.organisation_id:
            raise ValidationError("Technician must belong to same organisation")
        if self.technician and self.technician.role != "technician":
            raise ValidationError("Assigned user must be a technician")

    def save(self, *args, **kwargs):
        if not self.ref:
            # generate ref per org: count +1 with prefix
            # need organisation to be set; use simple counter with race handled via retry in view
            prefix = self.organisation.slug.upper()[:4] if self.organisation and self.organisation.slug else "WO"
            # find max ref number for this org
            last = WorkOrder.objects.filter(organisation=self.organisation).order_by("-created_at").first()
            # naive; view will handle retry on conflict
            count = WorkOrder.objects.filter(organisation=self.organisation).count() + 1
            self.ref = f"{prefix}-{count:06d}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.ref} {self.title}"


class Attachment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organisation = models.ForeignKey("accounts.Organisation", on_delete=models.CASCADE, related_name="attachments")
    work_order = models.ForeignKey(WorkOrder, on_delete=models.CASCADE, related_name="attachments")
    file = models.FileField(upload_to="attachments/%Y/%m/%d/")
    original_name = models.CharField(max_length=255)
    mime_type = models.CharField(max_length=100)
    size = models.BigIntegerField()
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.original_name
