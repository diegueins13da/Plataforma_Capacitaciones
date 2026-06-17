from rest_framework.routers import DefaultRouter

from .views import SystemSettingViewSet

router = DefaultRouter()
router.register(r"config", SystemSettingViewSet, basename="config")

urlpatterns = router.urls
