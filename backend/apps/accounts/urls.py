from django.urls import path
from .views import LoginView, LogoutView, MeView, UserListCreateView, UserDetailView
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    path("login/", LoginView.as_view(), name="login"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("me/", MeView.as_view(), name="me"),
    path("users/", UserListCreateView.as_view(), name="user-list"),
    path("users/<uuid:id>/", UserDetailView.as_view(), name="user-detail"),
]
