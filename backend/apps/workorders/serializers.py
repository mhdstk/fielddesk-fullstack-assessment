from rest_framework import serializers
from .models import WorkOrder, Attachment
from apps.accounts.serializers import UserSerializer

class AttachmentSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    class Meta:
        model = Attachment
        fields = ["id", "original_name", "mime_type", "size", "created_at", "uploaded_by", "url"]
        read_only_fields = fields

    def get_url(self, obj):
        return f"/api/work-orders/{obj.work_order_id}/attachments/{obj.id}/download/"

class WorkOrderSerializer(serializers.ModelSerializer):
    technician = UserSerializer(read_only=True)
    technician_id = serializers.UUIDField(write_only=True, required=False, allow_null=True)
    attachments = AttachmentSerializer(many=True, read_only=True)
    creator = UserSerializer(read_only=True)
    class Meta:
        model = WorkOrder
        fields = ["id", "ref", "title", "description", "priority", "status", "technician", "technician_id", "scheduled_start", "scheduled_end", "site_name", "organisation", "creator", "created_at", "updated_at", "attachments"]
        read_only_fields = ["id", "ref", "organisation", "creator", "created_at", "updated_at", "technician", "attachments"]

    def validate(self, attrs):
        start = attrs.get("scheduled_start") or (self.instance.scheduled_start if self.instance else None)
        end = attrs.get("scheduled_end") or (self.instance.scheduled_end if self.instance else None)
        if start and end and end <= start:
            raise serializers.ValidationError({"scheduled_end": "Scheduled end time must be after scheduled start time."})
        # if one provided without other, ensure consistency with existing instance
        if "scheduled_start" in attrs and self.instance and not attrs.get("scheduled_end") and self.instance.scheduled_end:
            if attrs["scheduled_start"] and self.instance.scheduled_end <= attrs["scheduled_start"]:
                raise serializers.ValidationError({"scheduled_end": "Scheduled end time must be after scheduled start time."})
        if "scheduled_end" in attrs and self.instance and not attrs.get("scheduled_start") and self.instance.scheduled_start:
            if attrs["scheduled_end"] and attrs["scheduled_end"] <= self.instance.scheduled_start:
                raise serializers.ValidationError({"scheduled_end": "Scheduled end time must be after scheduled start time."})
        # technician must be in same org - checked in view with request user org
        tech_id = attrs.get("technician_id")
        if tech_id is not None and tech_id != "":
            from apps.accounts.models import User
            try:
                tech = User.objects.get(id=tech_id)
            except User.DoesNotExist:
                raise serializers.ValidationError({"technician_id": "Technician not found in organisation."})
            if tech.role != "technician":
                raise serializers.ValidationError({"technician_id": "Assigned user is not a technician."})
            # org check deferred to view where request is available
        return attrs

class WorkOrderCreateSerializer(WorkOrderSerializer):
    pass

class AssignSerializer(serializers.Serializer):
    technician_id = serializers.UUIDField()
    scheduled_start = serializers.DateTimeField(required=False, allow_null=True)
    scheduled_end = serializers.DateTimeField(required=False, allow_null=True)

    def validate(self, attrs):
        s = attrs.get("scheduled_start")
        e = attrs.get("scheduled_end")
        if s and e and e <= s:
            raise serializers.ValidationError("Scheduled end time must be after scheduled start time.")
        return attrs
