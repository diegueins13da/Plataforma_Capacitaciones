"""
Custom DRF permission classes for role-based access control.

Usage:
    class MyView(APIView):
        permission_classes = [IsAuthenticated, IsAdmin]
"""
from rest_framework.permissions import BasePermission
from rest_framework.request import Request


class IsAdmin(BasePermission):
    """Grants access only to users with role=ADMIN."""

    message = "Se requiere rol de Administrador para acceder a este recurso."

    def has_permission(self, request: Request, view: object) -> bool:
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == "ADMIN"
        )


class IsAdminOrTrainer(BasePermission):
    """Grants access to users with role=ADMIN or role=TRAINER.
    Users with role=USUARIO are always denied.
    """

    message = "Se requiere rol de Administrador o Capacitador para acceder a este recurso."

    def has_permission(self, request: Request, view: object) -> bool:
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role in ("ADMIN", "TRAINER")
        )
