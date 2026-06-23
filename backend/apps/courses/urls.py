from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import CourseViewSet, EnrollmentViewSet, instructor_dashboard

router = DefaultRouter()
router.register(r"courses", CourseViewSet, basename="course")
router.register(r"enrollments", EnrollmentViewSet, basename="enrollment")

urlpatterns = router.urls + [
    path("instructor/dashboard/", instructor_dashboard, name="instructor-dashboard"),
]
