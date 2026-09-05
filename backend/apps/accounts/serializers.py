from rest_framework import serializers
from .models import User, Organisation

class OrganisationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organisation
        fields = ["id", "name", "slug", "storage_limit_bytes"]

class UserSerializer(serializers.ModelSerializer):
    organisation = OrganisationSerializer(read_only=True)
    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name", "role", "organisation", "is_active"]
        read_only_fields = ["id"]

class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name", "role", "password"]
        read_only_fields = ["id"]

    def create(self, validated_data):
        request = self.context["request"]
        org = request.user.organisation
        validated_data["organisation"] = org
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user

class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField()

    def validate(self, attrs):
        from django.contrib.auth import authenticate
        user = authenticate(username=attrs["username"], password=attrs["password"])
        if not user:
            raise serializers.ValidationError("Invalid credentials")
        if not user.is_active:
            raise serializers.ValidationError("User inactive")
        attrs["user"] = user
        return attrs
