from django.urls import re_path
from .consumers import WorkOrderConsumer

websocket_urlpatterns = [
    re_path(r"ws/work-orders/$", WorkOrderConsumer.as_asgi()),
]
