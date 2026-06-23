from django.urls import path

from .views import (
    AuditLogListView,
    CertificatesReportView,
    CoursesSummaryReportView,
    UserProgressReportView,
)

urlpatterns = [
    path("reports/audit-logs/", AuditLogListView.as_view(), name="audit-log-list"),
    path("reports/users-progress/", UserProgressReportView.as_view(), name="report-users-progress"),
    path("reports/courses-summary/", CoursesSummaryReportView.as_view(), name="report-courses-summary"),
    path("reports/certificates/", CertificatesReportView.as_view(), name="report-certificates"),
]
