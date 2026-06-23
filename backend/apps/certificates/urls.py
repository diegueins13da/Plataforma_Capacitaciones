from django.urls import path
from .views import (
    my_certificates,
    admin_certificates,
    download_certificate,
    verify_certificate,
    generate_certificate,
)

urlpatterns = [
    path("certificates/mine/", my_certificates, name="certificates-mine"),
    path("certificates/admin/", admin_certificates, name="certificates-admin"),
    path("certificates/<uuid:cert_id>/download/", download_certificate, name="certificate-download"),
    path("certificates/<uuid:cert_id>/verify/", verify_certificate, name="certificate-verify"),
    path("certificates/<uuid:cert_id>/generate/", generate_certificate, name="certificate-generate"),
]
