import uuid
from django.db import models
from django.contrib.auth.models import AbstractUser

class Organisation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    slug = models.SlugField(unique=True)
    storage_limit_bytes = models.BigIntegerField(default=104857600)  # 100 MB
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class User(AbstractUser):
    class Role(models.TextChoices):
        OWNER = "owner", "Owner"
        DISPATCHER = "dispatcher", "Dispatcher"
        TECHNICIAN = "technician", "Technician"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organisation = models.ForeignKey(Organisation, on_delete=models.CASCADE, related_name="users")
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.TECHNICIAN)
    # make email not necessarily unique globally, but per org is not enforced at DB easily; keep unique together via constraint later if needed
    email = models.EmailField()

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["organisation", "username"], name="uniq_user_org_username"),
            models.UniqueConstraint(fields=["organisation", "email"], name="uniq_user_org_email"),
        ]

    def __str__(self):
        return f"{self.username} ({self.organisation.slug}/{self.role})"
