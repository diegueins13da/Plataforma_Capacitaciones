"""
User app views — Group management ViewSet + User management ViewSet.
"""
from django.core.exceptions import ValidationError as DjangoValidationError
from django.shortcuts import get_object_or_404
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from . import services
from .models import Group, User, UserProfile
from .permissions import IsAdmin
from .serializers import (
    AddMembersSerializer,
    ChangeRoleSerializer,
    GroupMemberSerializer,
    GroupSerializer,
    UserCreateSerializer,
    UserListSerializer,
    UserUpdateSerializer,
)


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


# ---------------------------------------------------------------------------
# User management ViewSet
# ---------------------------------------------------------------------------


try:
    import django_filters  # noqa: F401
    _HAS_DJANGO_FILTERS = True
except ImportError:
    _HAS_DJANGO_FILTERS = False


class UserViewSet(viewsets.GenericViewSet):
    """
    User management endpoints — all restricted to ADMIN.

    Routes:
      GET    /users/              list (paginated, filterable)
      POST   /users/              create user
      GET    /users/{id}/         retrieve
      PATCH  /users/{id}/         update profile fields
      POST   /users/{id}/change-role/   change role
      POST   /users/{id}/deactivate/    deactivate + blacklist tokens
    """

    permission_classes = [IsAuthenticated, IsAdmin]
    filter_backends = [filters.SearchFilter]
    search_fields = ["first_name", "last_name", "email"]

    def get_queryset(self):
        qs = User.objects.select_related("profile__grupo").order_by("last_name", "first_name")
        # Manual filtering (django-filter not configured here; use query params)
        role = self.request.query_params.get("role")
        is_active = self.request.query_params.get("is_active")
        area = self.request.query_params.get("area")
        if role:
            qs = qs.filter(role=role)
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() in ("true", "1", "yes"))
        if area:
            qs = qs.filter(profile__area__icontains=area)
        return qs

    def list(self, request):
        qs = self.get_queryset()
        # Apply search manually since filter_backends don't activate on GenericViewSet
        search = request.query_params.get("search")
        if search:
            from django.db.models import Q
            qs = qs.filter(
                Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
                | Q(email__icontains=search)
            )
        page = self.paginate_queryset(qs)
        if page is not None:
            return self.get_paginated_response(UserListSerializer(page, many=True).data)
        return Response(UserListSerializer(qs, many=True).data)

    def create(self, request):
        serializer = UserCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        user = services.create_user(
            email=data["email"],
            first_name=data["first_name"],
            last_name=data["last_name"],
            role=data.get("role", User.Role.USUARIO),
            area=data.get("area", ""),
            cargo=data.get("cargo", ""),
            grupo_id=data.get("grupo_id"),
            admin_user=request.user,
            ip=_get_client_ip(request),
        )
        return Response(UserListSerializer(user).data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, pk=None):
        user = get_object_or_404(User, pk=pk)
        serializer = UserUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        updated = services.update_user(user, **data)
        updated.refresh_from_db()
        try:
            updated.profile.refresh_from_db()
        except UserProfile.DoesNotExist:
            pass
        return Response(UserListSerializer(updated).data)

    def retrieve(self, request, pk=None):
        user = get_object_or_404(User, pk=pk)
        return Response(UserListSerializer(user).data)

    @action(detail=True, methods=["post"], url_path="change-role")
    def change_role(self, request, pk=None):
        user = get_object_or_404(User, pk=pk)
        serializer = ChangeRoleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        updated = services.change_role(
            user,
            new_role=serializer.validated_data["new_role"],
            admin_user=request.user,
            ip=_get_client_ip(request),
        )
        return Response(UserListSerializer(updated).data)

    @action(detail=True, methods=["post"])
    def deactivate(self, request, pk=None):
        user = get_object_or_404(User, pk=pk)
        updated = services.deactivate_user(
            user,
            admin_user=request.user,
            ip=_get_client_ip(request),
        )
        return Response(UserListSerializer(updated).data)


def _get_client_ip(request) -> str:
    x_forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if x_forwarded:
        return x_forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "")
