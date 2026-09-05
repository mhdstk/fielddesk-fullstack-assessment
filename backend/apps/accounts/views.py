from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.db.models import Q
from .models import User
from .serializers import UserSerializer, UserCreateSerializer
from apps.core.permissions import IsOwner
from rest_framework.permissions import IsAuthenticated
from django.core.cache import cache
import time

def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    # add custom claims
    refresh["org_id"] = str(user.organisation_id)
    refresh["role"] = user.role
    refresh["username"] = user.username
    access = refresh.access_token
    access["org_id"] = str(user.organisation_id)
    access["role"] = user.role
    return {"refresh": str(refresh), "access": str(access)}

class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        # simple rate limit: 5/min per IP
        ip = request.META.get("REMOTE_ADDR", "anon")
        key = f"ratelimit:login:{ip}"
        count = cache.get(key, 0)
        if count >= 5:
            return Response({"error": {"code": "rate_limited", "message": "Too many login attempts", "requestId": getattr(request, "request_id", None)}}, status=429)
        username = request.data.get("username")
        password = request.data.get("password")
        if not username or not password:
            return Response({"error": {"code": "validation_error", "message": "username and password required", "requestId": getattr(request, "request_id", None)}}, status=400)
        user = authenticate(username=username, password=password)
        if not user or not user.is_active:
            cache.set(key, count + 1, timeout=60)
            return Response({"error": {"code": "unauthorized", "message": "Invalid credentials", "requestId": getattr(request, "request_id", None)}}, status=401)
        cache.delete(key)
        tokens = get_tokens_for_user(user)
        return Response({"access": tokens["access"], "refresh": tokens["refresh"], "user": UserSerializer(user).data})

class LogoutView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        # With JWT, logout is client-side; we optionally blacklist if configured
        try:
            refresh = request.data.get("refresh")
            if refresh:
                token = RefreshToken(refresh)
                token.blacklist()
        except Exception:
            pass
        return Response({"detail": "Logged out"})

class MeView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        return Response(UserSerializer(request.user).data)

class UserListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return UserCreateSerializer
        return UserSerializer

    def get_queryset(self):
        # org isolation
        return User.objects.filter(organisation=self.request.user.organisation).select_related("organisation")

    def get_permissions(self):
        if self.request.method == "POST":
            # only owner can create
            return [IsAuthenticated(), IsOwner()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        serializer.save()

class UserDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticated, IsOwner]
    serializer_class = UserSerializer
    lookup_field = "id"

    def get_queryset(self):
        return User.objects.filter(organisation=self.request.user.organisation)

    def perform_update(self, serializer):
        from apps.audit.models import AuditLog
        old_role = self.get_object().role
        user = serializer.save()
        # audit role change
        if old_role != user.role:
            AuditLog.objects.create(
                organisation=self.request.user.organisation,
                actor=self.request.user,
                action="user_role_changed",
                target_type="user",
                target_id=str(user.id),
                before={"role": old_role},
                after={"role": user.role},
            )
        return user
