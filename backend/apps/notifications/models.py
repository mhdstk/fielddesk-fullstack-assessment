import uuid
from django.db import models
from django.conf import settings

class NotificationAttempt(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        SUCCESS = "success", "Success"
        TEMP_FAIL = "temp_fail", "Temporary Failure"
        PERM_FAIL = "perm_fail", "Permanent Failure"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organisation = models.ForeignKey("accounts.Organisation", on_delete=models.CASCADE)
    work_order = models.ForeignKey("workorders.WorkOrder", on_delete=models.CASCADE)
    technician = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    attempts = models.IntegerField(default=0)
    last_error = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["work_order", "technician"], name="uniq_notif_wo_tech"),
        ]

    def __str__(self):
        return f"Notif {self.work_order} -> {self.technician} {self.status}"
