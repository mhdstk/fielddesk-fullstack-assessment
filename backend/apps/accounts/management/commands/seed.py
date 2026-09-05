from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from apps.accounts.models import Organisation
from apps.workorders.models import WorkOrder
from django.utils import timezone
from datetime import timedelta
import uuid

User = get_user_model()

class Command(BaseCommand):
    help = "Seed two organisations with users and work orders"

    def handle(self, *args, **options):
        self.stdout.write("Seeding...")
        # Clean existing
        Organisation.objects.all().delete()
        # Org 1: Apex Field Services (slug 'acme' kept for credential compatibility)
        org1 = Organisation.objects.create(name="Apex Field Services", slug="acme", storage_limit_bytes=104857600)
        org2 = Organisation.objects.create(name="NorthPeak Maintenance", slug="globex", storage_limit_bytes=104857600)

        def create_users(org, prefix):
            users = {}
            for role in ["owner", "dispatcher", "technician"]:
                username = f"{prefix}_{role}"
                email = f"{prefix}_{role}@example.com"
                u = User.objects.create_user(
                    username=username,
                    email=email,
                    password="Password123!",
                    organisation=org,
                    role=role,
                    first_name=role.capitalize(),
                    last_name=prefix.capitalize(),
                    is_active=True,
                )
                users[role] = u
                self.stdout.write(f"  {username} / Password123! ({org.slug}/{role})")
            # extra technician
            u2 = User.objects.create_user(
                username=f"{prefix}_tech2",
                email=f"{prefix}_tech2@example.com",
                password="Password123!",
                organisation=org,
                role="technician",
                first_name="Tech2",
                last_name=prefix.capitalize(),
                is_active=True,
            )
            users["tech2"] = u2
            self.stdout.write(f"  {prefix}_tech2 / Password123! ({org.slug}/technician)")
            return users

        acme_users = create_users(org1, "acme")
        globex_users = create_users(org2, "globex")

        # Create work orders
        now = timezone.now()
        for org, users, prefix in [(org1, acme_users, "Apex"), (org2, globex_users, "NorthPeak")]:
            for i in range(1, 6):
                wo = WorkOrder.objects.create(
                    organisation=org,
                    title=f"{prefix} Work Order {i}",
                    description=f"HVAC/electrical maintenance task for {prefix} — site {i} scheduled maintenance",
                    priority=["low", "medium", "high", "urgent"][i % 4],
                    status=["open", "scheduled", "in_progress", "open", "completed"][i % 5],
                    site_name=f"Site {i} — {org.name}",
                    scheduled_start=now + timedelta(days=i, hours=2) if i % 2 == 0 else None,
                    scheduled_end=now + timedelta(days=i, hours=4) if i % 2 == 0 else None,
                    technician=users["technician"] if i % 3 == 0 else None,
                    creator=users["dispatcher"],
                )
                self.stdout.write(f"  WO {wo.ref} created for {org.slug} ({org.name})")

        self.stdout.write(self.style.SUCCESS("Seeding complete. Login with e.g. acme_owner / Password123!"))
