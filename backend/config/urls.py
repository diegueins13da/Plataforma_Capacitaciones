from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    # Infrastructure — no versioning needed for health checks
    path("api/", include("apps.core.urls")),
    # Versioned API
    path(
        "api/v1/",
        include(
            [
                path("auth/", include("apps.authentication.urls")),
                path("", include("apps.users.urls")),
                path("", include("apps.config.urls")),
                # courses, assessments etc. added in subsequent tasks
            ]
        ),
    ),
]
