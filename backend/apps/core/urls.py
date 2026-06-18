from django.urls import path

from .views import deep_health_check, health_check

urlpatterns = [
    path("health/", health_check, name="health-check"),
    path("health/deep/", deep_health_check, name="health-check-deep"),
]
