import logging
from celery import shared_task
from celery.exceptions import MaxRetriesExceededError
from django.utils import timezone
from .mocks import mock_send_notification, MockProviderError
from .models import NotificationAttempt

logger = logging.getLogger("apps.notifications")

@shared_task(bind=True, max_retries=5, default_retry_delay=5, acks_late=True)
def notify_technician_assignment(self, work_order_id, technician_id):
    from apps.workorders.models import WorkOrder
    from apps.accounts.models import User
    from apps.audit.models import AuditLog

    try:
        wo = WorkOrder.objects.select_related("organisation", "technician").get(id=work_order_id)
        tech = User.objects.get(id=technician_id)
    except Exception as e:
        logger.error(f"Notification invalid job work_order={work_order_id} tech={technician_id} error={e}")
        # permanent invalid - do not retry
        return {"status": "perm_fail", "error": str(e)}

    # dedup: get or create attempt record
    attempt_obj, created = NotificationAttempt.objects.get_or_create(
        work_order=wo, technician=tech, defaults={"organisation": wo.organisation}
    )
    # if already success, avoid duplicate
    if attempt_obj.status == "success":
        logger.info(f"Notification already succeeded for {wo.ref} -> {tech.email}, skipping duplicate")
        return {"status": "already_success"}

    attempt_number = attempt_obj.attempts + 1
    try:
        mock_send_notification(tech.email, wo.ref, attempt=attempt_number)
        attempt_obj.attempts = attempt_number
        attempt_obj.status = "success"
        attempt_obj.last_error = ""
        attempt_obj.save()
        AuditLog.objects.create(
            organisation=wo.organisation,
            actor=None,
            action="notification_sent",
            target_type="work_order",
            target_id=str(wo.id),
            after={"technician_id": str(tech.id), "attempt": attempt_number, "status": "success"},
        )
        logger.info(f"Notification success {wo.ref} -> {tech.email} attempt {attempt_number}")
        return {"status": "success"}

    except MockProviderError as e:
        attempt_obj.attempts = attempt_number
        attempt_obj.last_error = str(e)
        if e.temporary:
            attempt_obj.status = "temp_fail"
            attempt_obj.save()
            AuditLog.objects.create(
                organisation=wo.organisation,
                actor=None,
                action="notification_temp_fail",
                target_type="work_order",
                target_id=str(wo.id),
                after={"technician_id": str(tech.id), "attempt": attempt_number, "error": str(e)},
            )
            # retry with exponential backoff: 2^retry * base
            countdown = (2 ** self.request.retries) * 5
            logger.warning(f"Temp fail {wo.ref} attempt {attempt_number}, retry in {countdown}s error={e}")
            try:
                raise self.retry(exc=e, countdown=countdown)
            except MaxRetriesExceededError:
                attempt_obj.status = "temp_fail"
                attempt_obj.save()
                logger.error(f"Max retries exceeded for {wo.ref}")
                return {"status": "max_retries", "error": str(e)}
        else:
            attempt_obj.status = "perm_fail"
            attempt_obj.save()
            AuditLog.objects.create(
                organisation=wo.organisation,
                actor=None,
                action="notification_perm_fail",
                target_type="work_order",
                target_id=str(wo.id),
                after={"technician_id": str(tech.id), "error": str(e)},
            )
            logger.error(f"Permanent fail {wo.ref} -> {tech.email} error={e} - not retrying")
            return {"status": "perm_fail", "error": str(e)}

    except Exception as e:
        # unexpected - treat as temp
        attempt_obj.attempts = attempt_number
        attempt_obj.last_error = str(e)
        attempt_obj.status = "temp_fail"
        attempt_obj.save()
        logger.exception(f"Unexpected error notifying {wo.ref}: {e}")
        try:
            raise self.retry(exc=e, countdown=10)
        except MaxRetriesExceededError:
            return {"status": "max_retries", "error": str(e)}
