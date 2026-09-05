from rest_framework.permissions import BasePermission

class IsOwner(BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role == "owner"

class IsDispatcher(BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role in ("owner", "dispatcher")

class IsTechnician(BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated

def is_owner(user):
    return user.role == "owner"

def is_dispatcher(user):
    return user.role in ("owner", "dispatcher")

def is_technician(user):
    return user.role == "technician"
