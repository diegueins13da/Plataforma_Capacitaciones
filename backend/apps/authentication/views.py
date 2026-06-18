from django.core.exceptions import ValidationError as DjangoValidationError
from ratelimit.decorators import ratelimit
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from . import services
from .serializers import (
    ChangePasswordSerializer,
    LoginRequestSerializer,
    LoginResponseSerializer,
    MeSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    UpdateMeSerializer,
)


@ratelimit(key="ip", rate="10/m", method="POST", block=False)
@api_view(["POST"])
@permission_classes([AllowAny])
def login(request):
    if getattr(request, "limited", False):
        return Response(
            {
                "errors": {
                    "non_field_errors": [
                        "Demasiadas solicitudes. Intenta de nuevo en un minuto."
                    ]
                },
                "status": 429,
            },
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    serializer = LoginRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    try:
        result = services.login(
            email=serializer.validated_data["email"],
            password=serializer.validated_data["password"],
            ip=services.get_client_ip(request),
        )
    except services.AuthenticationError as exc:
        body: dict = {
            "errors": {"non_field_errors": [str(exc)]},
            "status": 401,
        }
        if exc.attempts_left is not None:
            body["attempts_left"] = exc.attempts_left
        return Response(body, status=status.HTTP_401_UNAUTHORIZED)

    return Response(LoginResponseSerializer(result).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout(request):
    services.logout(
        user=request.user,
        refresh_token=request.data.get("refresh"),
        ip=services.get_client_ip(request),
    )
    return Response({"detail": "Sesión cerrada correctamente."})


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def me(request):
    if request.method == "GET":
        return Response(MeSerializer(request.user).data)

    serializer = UpdateMeSerializer(data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    user = request.user
    user_fields = [f for f in ("first_name", "last_name") if f in data]
    for field in user_fields:
        setattr(user, field, data[field])
    if user_fields:
        user.save(update_fields=user_fields)
    if "cargo" in data:
        profile, _ = user.profile.__class__.objects.get_or_create(user=user)
        profile.cargo = data["cargo"]
        profile.save(update_fields=["cargo"])
    return Response(MeSerializer(user).data)


@ratelimit(key="ip", rate="5/m", method="POST", block=False)
@api_view(["POST"])
@permission_classes([AllowAny])
def password_reset_request(request):
    if getattr(request, "limited", False):
        # Still return 200 to avoid timing attacks / enumeration
        return Response({"detail": "Si tu correo existe, recibirás un código en breve."})

    serializer = PasswordResetRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    services.request_password_reset(email=serializer.validated_data["email"])

    # ALWAYS return 200 with the same message — prevents user enumeration
    return Response({"detail": "Si tu correo existe, recibirás un código en breve."})


@api_view(["POST"])
@permission_classes([AllowAny])
def password_reset_confirm(request):
    serializer = PasswordResetConfirmSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    try:
        services.confirm_password_reset(
            email=serializer.validated_data["email"],
            code=serializer.validated_data["code"],
            new_password=serializer.validated_data["new_password"],
        )
    except services.PasswordResetError as exc:
        return Response(
            {"errors": {"non_field_errors": [str(exc)]}, "status": 400},
            status=status.HTTP_400_BAD_REQUEST,
        )
    except DjangoValidationError as exc:
        return Response(
            {"errors": {"new_password": list(exc.messages)}, "status": 400},
            status=status.HTTP_400_BAD_REQUEST,
        )

    return Response({"detail": "Contraseña actualizada correctamente."})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def change_password(request):
    serializer = ChangePasswordSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    try:
        services.change_password(
            user=request.user,
            current_password=serializer.validated_data["current_password"],
            new_password=serializer.validated_data["new_password"],
            ip=services.get_client_ip(request),
        )
    except services.PasswordResetError as exc:
        return Response(
            {"errors": {"current_password": [str(exc)]}, "status": 400},
            status=status.HTTP_400_BAD_REQUEST,
        )
    except DjangoValidationError as exc:
        return Response(
            {"errors": {"new_password": list(exc.messages)}, "status": 400},
            status=status.HTTP_400_BAD_REQUEST,
        )

    return Response({"detail": "Contraseña cambiada correctamente."})
