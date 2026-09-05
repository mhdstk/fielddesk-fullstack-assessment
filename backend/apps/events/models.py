import uuid
from django.db import models
from django.conf import settings

class ProgressEvent(models.Model):
    class Type(models.TextChoices):
        STATUS_CHANGED = "status_changed", "Status Changed"
        NOTE_ADDED = "note_added", "Note Added"
        ARRIVED = "arrived", "Arrived"
        WORK_STARTED = "work_started", "Work Started"
        WORK_COMPLETED = "work_completed", "Work Completed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # client-supplied idempotency key
    event_id = models.CharField(max_length=100)
    organisation = models.ForeignKey("accounts.Organisation", on_delete=models.CASCADE, related_name="progress_events")
    work_order = models.ForeignKey("workorders.WorkOrder", on_delete=models.CASCADE, related_name="progress_events")
    type = models.CharField(max_length=50, choices=Type.choices)
    occurred_at = models.DateTimeField()
    payload = models.JSONField(default=dict)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    raw_request = models.JSONField(default=dict)  # immutable audit of original request

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["organisation", "event_id"], name="uniq_org_event_id"),
        ]
        indexes = [
            models.Index(fields=["organisation", "work_order"]),
            models.Index(fields=["organisation", "event_id"]),
        ]

    def __str__(self):
        return f"{self.event_id} {self.type}"
