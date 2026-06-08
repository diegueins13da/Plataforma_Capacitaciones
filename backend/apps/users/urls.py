from rest_framework.routers import DefaultRouter

from .views import GroupViewSet, UserViewSet

router = DefaultRouter()
router.register(r"groups", GroupViewSet, basename="group")
router.register(r"users", UserViewSet, basename="user")

urlpatterns = router.urls
