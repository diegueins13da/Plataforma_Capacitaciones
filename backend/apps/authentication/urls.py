from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from . import views

urlpatterns = [
    path("login/", views.login, name="auth-login"),
    path("logout/", views.logout, name="auth-logout"),
    path("token/refresh/", TokenRefreshView.as_view(), name="auth-token-refresh"),
    path("me/", views.me, name="auth-me"),
    path("mfa/verify/", views.mfa_verify, name="auth-mfa-verify"),
    path("mfa/resend/", views.mfa_resend, name="auth-mfa-resend"),
    path("password-reset/", views.password_reset_request, name="auth-password-reset"),
    path("password-reset/confirm/", views.password_reset_confirm, name="auth-password-reset-confirm"),
    path("change-password/", views.change_password, name="auth-change-password"),
]
