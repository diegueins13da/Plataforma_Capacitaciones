from django.conf import settings
from django.conf.urls.static import static
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
                path("", include("apps.courses.urls")),
                path("", include("apps.assessments.urls")),
                path("", include("apps.ai_generator.urls")),
                path("", include("apps.notifications.urls")),
                path("", include("apps.reports.urls")),
                path("", include("apps.certificates.urls")),
            ]
        ),
    ),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    try:
        import debug_toolbar  # noqa: PLC0415

        urlpatterns += [path("__debug__/", include(debug_toolbar.urls))]
    except ImportError:
        pass
