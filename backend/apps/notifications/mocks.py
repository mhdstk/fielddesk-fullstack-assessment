import os
import random
import logging

logger = logging.getLogger("apps.notifications")

class MockProviderError(Exception):
    def __init__(self, message, temporary=True):
        super().__init__(message)
        self.temporary = temporary

def mock_send_notification(technician_email, work_order_ref, attempt=1):
    """
    Controllable mock provider.
    Mode via env MOCK_PROVIDER_MODE: success | temp_fail | perm_fail | random
    Also supports per-work-order override via work_order_ref containing hint.
    """
    mode = os.getenv("MOCK_PROVIDER_MODE", "success")
    # Allow deterministic testing via ref hints
    if "TEMP" in work_order_ref:
        mode = "temp_fail"
    if "PERM" in work_order_ref:
        mode = "perm_fail"

    if mode == "success":
        logger.info(f"[mock] notification sent to {technician_email} for {work_order_ref} attempt {attempt}")
        return True
    elif mode == "temp_fail":
        # fail first 2 attempts then succeed
        if attempt < 3:
            logger.warning(f"[mock] temp failure for {technician_email} {work_order_ref} attempt {attempt}")
            raise MockProviderError("Temporary provider failure (503)", temporary=True)
        logger.info(f"[mock] recovered success for {technician_email} after {attempt} attempts")
        return True
    elif mode == "perm_fail":
        logger.error(f"[mock] permanent failure for {technician_email} {work_order_ref}")
        raise MockProviderError("Permanent failure - invalid recipient (400)", temporary=False)
    elif mode == "random":
        r = random.random()
        if r < 0.3:
            raise MockProviderError("Random temp fail", temporary=True)
        elif r < 0.35:
            raise MockProviderError("Random perm fail", temporary=False)
        return True
    else:
        return True
