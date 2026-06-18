from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.users.permissions import IsAdmin

from .models import AuditLog
from .serializers import AuditLogSerializer


class AuditLogPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 200


class AuditLogListView(APIView):
    """GET /v1/reports/audit-logs/ — paginated audit log for admins."""

    permission_classes = [IsAuthenticated, IsAdmin]
    pagination_class = AuditLogPagination

    def get(self, request: Request) -> Response:
        qs = AuditLog.objects.select_related("user").order_by("-timestamp")

        # Optional filters
        user_email = request.query_params.get("user_email")
        accion = request.query_params.get("accion")
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")

        if user_email:
            qs = qs.filter(user__email__icontains=user_email)
        if accion:
            qs = qs.filter(accion__icontains=accion)
        if date_from:
            qs = qs.filter(timestamp__date__gte=date_from)
        if date_to:
            qs = qs.filter(timestamp__date__lte=date_to)

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(qs, request)
        if page is not None:
            serializer = AuditLogSerializer(page, many=True)
            return paginator.get_paginated_response(serializer.data)

        serializer = AuditLogSerializer(qs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
