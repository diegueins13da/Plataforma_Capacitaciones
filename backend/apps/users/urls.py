from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import AreaViewSet, GroupViewSet, UserDashboardView, UserViewSet

router = DefaultRouter()
router.register(r"areas", AreaViewSet, basename="area")
router.register(r"groups", GroupViewSet, basename="group")
router.register(r"users", UserViewSet, basename="user")

urlpatterns = router.urls + [
    path("users/me/dashboard/", UserDashboardView.as_view(), name="user-dashboard"),
]
