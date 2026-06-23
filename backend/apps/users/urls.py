from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import AreaViewSet, CargoViewSet, GroupViewSet, UserDashboardView, UserViewSet, generate_rubrica, upload_rubrica

router = DefaultRouter()
router.register(r"areas", AreaViewSet, basename="area")
router.register(r"cargos", CargoViewSet, basename="cargo")
router.register(r"groups", GroupViewSet, basename="group")
router.register(r"users", UserViewSet, basename="user")

urlpatterns = router.urls + [
    path("users/me/dashboard/", UserDashboardView.as_view(), name="user-dashboard"),
    path("users/me/rubrica/", upload_rubrica, name="user-rubrica-upload"),
    path("users/me/rubrica/generate/", generate_rubrica, name="user-rubrica-generate"),
]
