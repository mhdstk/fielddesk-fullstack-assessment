from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import Organisation, User

@admin.register(Organisation)
class OrganisationAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "storage_limit_bytes", "created_at")

@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ("username", "email", "organisation", "role", "is_active")
    list_filter = ("role", "organisation")
    fieldsets = BaseUserAdmin.fieldsets + (("FieldDesk", {"fields": ("organisation", "role")}),)
