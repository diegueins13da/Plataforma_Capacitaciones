"""
User app views — Group management ViewSet.
"""
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from . import services
from .models import Group, UserProfile
from .permissions import IsAdmin
from .serializers import AddMembersSerializer, GroupMemberSerializer, GroupSerializer


class GroupViewSet(viewsets.ModelViewSet):
    """
    CRUD endpoints for organizational groups.
    Only ADMIN users can access any of these endpoints.
    """

    queryset = Group.objects.all()
    serializer_class = GroupSerializer
    permission_classes = [IsAuthenticated, IsAdmin]

    def perform_create(self, serializer):
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        group = self.get_object()
        try:
            services.delete_group(group)
        except DjangoValidationError as exc:
            return Response(
                {"errors": exc.message_dict},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)

    # ------------------------------------------------------------------
    # Members sub-resource:  /groups/{pk}/members/
    # ------------------------------------------------------------------

    @action(
        detail=True,
        methods=["get", "post"],
        url_path="members",
        url_name="members",
    )
    def members(self, request, pk=None):
        group = self.get_object()

        if request.method == "GET":
            qs = group.members.select_related("user").order_by("user__last_name", "user__first_name")
            page = self.paginate_queryset(qs)
            if page is not None:
                serializer = GroupMemberSerializer(page, many=True)
                return self.get_paginated_response(serializer.data)
            serializer = GroupMemberSerializer(qs, many=True)
            return Response(serializer.data)

        # POST — add members
        serializer = AddMembersSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            profiles = services.add_members(group, serializer.validated_data["user_ids"])
        except DjangoValidationError as exc:
            return Response(
                {"errors": exc.message_dict},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(
            GroupMemberSerializer(profiles, many=True).data,
            status=status.HTTP_200_OK,
        )

    @action(
        detail=True,
        methods=["delete"],
        url_path=r"members/(?P<user_id>\d+)",
        url_name="member-remove",
    )
    def member_remove(self, request, pk=None, user_id=None):
        group = self.get_object()
        try:
            services.remove_member(group, int(user_id))
        except DjangoValidationError as exc:
            return Response(
                {"errors": exc.message_dict},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)
