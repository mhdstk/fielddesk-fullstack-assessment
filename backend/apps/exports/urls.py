from django.urls import path
from .views import WorkOrderCSVExportView

urlpatterns = [
    path("work-orders.csv", WorkOrderCSVExportView.as_view(), name="csv-export"),
]
