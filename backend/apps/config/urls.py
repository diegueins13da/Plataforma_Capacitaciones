from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import SystemSettingViewSet, public_branding, test_email

router = DefaultRouter()
router.register(r"config", SystemSettingViewSet, basename="config")

# Fixed paths must come BEFORE router.urls to avoid the {clave} pattern
# matching "public" or "test-email" as setting keys.
urlpatterns = [
    path("config/public/", public_branding, name="config-public"),
    path("config/test-email/", test_email, name="config-test-email"),
] + router.urls
