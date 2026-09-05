from rest_framework import serializers
from .models import ProgressEvent

class ProgressEventSerializer(serializers.ModelSerializer):
    # map spec fields: eventId, workOrderId, type, occurredAt, payload
    eventId = serializers.CharField(source="event_id")
    workOrderId = serializers.UUIDField(source="work_order_id")
    type = serializers.ChoiceField(choices=ProgressEvent.Type.choices)
    occurredAt = serializers.DateTimeField(source="occurred_at")
    payload = serializers.JSONField()

    class Meta:
        model = ProgressEvent
        fields = ["id", "eventId", "workOrderId", "type", "occurredAt", "payload", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate(self, attrs):
        # payload validation per type
        payload = attrs.get("payload", {})
        t = attrs.get("type")
        if t == "status_changed":
            if "status" not in payload:
                raise serializers.ValidationError({"payload": "status required for status_changed"})
            allowed = {"draft","open","scheduled","in_progress","blocked","completed","cancelled"}
            if payload["status"] not in allowed:
                raise serializers.ValidationError({"payload": f"invalid status {payload['status']}"})
        # occurredAt not too far future/past
        from django.utils import timezone
        occ = attrs.get("occurred_at")
        if occ:
            now = timezone.now()
            if occ > now + timezone.timedelta(minutes=5):
                raise serializers.ValidationError({"occurredAt": "cannot be in the future"})
            if occ < now - timezone.timedelta(days=30):
                raise serializers.ValidationError({"occurredAt": "too old"})
        return attrs
