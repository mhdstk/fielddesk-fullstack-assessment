import uuid
from django.db import models
from django.conf import settings

class AuditLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organisation = models.ForeignKey("accounts.Organisation", on_delete=models.CASCADE, related_name="audit_logs")
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="audit_logs")
    action = models.CharField(max_length=100)  # e.g. work_order_created, assignment_changed, status_changed, attachment_added, user_role_changed, notification_sent
    target_type = models.CharField(max_length=50)  # work_order, user, attachment, notification
    target_id = models.CharField(max_length=100)
    before = models.JSONField(null=True, blank=True)
    after = models.JSONField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    request_id = models.CharField(max_length=100, null=True, blank=True)

    class Meta:
        ordering = ["-timestamp"]
        indexes = [
            models.Index(fields=["organisation", "target_type", "target_id"]),
            models.Index(fields=["organisation", "timestamp"]),
        ]

    def __str__(self):
        return f"{self.action} {self.target_type}:{self.target_id} by {self.actor}"
