from django.urls import path
from .views import ProgressEventView

urlpatterns = [
    path("", ProgressEventView.as_view(), name="progress-event"),
]
