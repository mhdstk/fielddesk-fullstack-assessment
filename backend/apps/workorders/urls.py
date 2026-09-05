from django.urls import path
from .views import WorkOrderListCreateView, WorkOrderDetailView, AssignView, DashboardView, AuditListView, AttachmentUploadView, AttachmentDownloadView

urlpatterns = [
    path("", WorkOrderListCreateView.as_view(), name="workorder-list"),
    path("stats/", DashboardView.as_view(), name="dashboard"),
    path("<uuid:id>/", WorkOrderDetailView.as_view(), name="workorder-detail"),
    path("<uuid:id>/assign/", AssignView.as_view(), name="workorder-assign"),
    path("<uuid:id>/audit/", AuditListView.as_view(), name="workorder-audit"),
    path("<uuid:id>/attachments/", AttachmentUploadView.as_view(), name="attachment-upload"),
    path("<uuid:id>/attachments/<uuid:attachment_id>/download/", AttachmentDownloadView.as_view(), name="attachment-download"),
]
