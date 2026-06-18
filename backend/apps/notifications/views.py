from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from . import services
from .models import Notification
from .serializers import NotificationSerializer


class NotificationListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        qs = (
            Notification.objects.filter(user=request.user)
            .order_by("-created_at")[:50]
        )
        return Response(
            {
                "results": NotificationSerializer(qs, many=True).data,
                "unread_count": services.get_unread_count(request.user),
            }
        )


class MarkReadView(APIView):
    """Mark one or all notifications as read.
    POST /notifications/mark-read/          → marks all
    POST /notifications/mark-read/{id}/     → marks one
    """

    permission_classes = [IsAuthenticated]

    def post(self, request: Request, pk: int | None = None) -> Response:
        updated = services.mark_read(request.user, pk)
        return Response(
            {
                "updated": updated,
                "unread_count": services.get_unread_count(request.user),
            },
            status=status.HTTP_200_OK,
        )
