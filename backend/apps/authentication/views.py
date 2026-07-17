from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle


class LoginRateThrottle(AnonRateThrottle):
    rate = "10/min"
    scope = "login"


class MFAVerifyThrottle(AnonRateThrottle):
    # 10 attempts/minute per IP — tight because brute-forcing a 6-digit OTP is the main risk
    rate = "10/min"
    scope = "mfa_verify"


class MFAResendThrottle(AnonRateThrottle):
    rate = "5/min"
    scope = "mfa_resend"


class PasswordResetThrottle(AnonRateThrottle):
    rate = "5/min"
    scope = "password_reset"

from . import services
from .services import LdapUserError, MFAError
from .serializers import (
    ChangePasswordSerializer,
    LoginRequestSerializer,
    LoginResponseSerializer,
    MeSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    UpdateMeSerializer,
)


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([LoginRateThrottle])
def login(request):
    serializer = LoginRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    try:
        result = services.login(
            email=serializer.validated_data["email"],
            password=serializer.validated_data["password"],
            ip=services.get_client_ip(request),
            request=request,
        )
    except services.AuthenticationError as exc:
        body: dict = {
            "errors": {"non_field_errors": [str(exc)]},
            "status": 401,
        }
        if exc.attempts_left is not None:
            body["attempts_left"] = exc.attempts_left
        return Response(body, status=status.HTTP_401_UNAUTHORIZED)

    # MFA challenge — return token + masked email, no JWT yet
    if result.get("mfa_required"):
        return Response({
            "mfa_required": True,
            "mfa_token": result["mfa_token"],
            "email_hint": result["email_hint"],
        })

    return Response(LoginResponseSerializer(result).data)


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([MFAVerifyThrottle])
def mfa_verify(request):
    """Validate the OTP and return JWT tokens on success."""
    mfa_token = request.data.get("mfa_token", "")
    otp_code = request.data.get("otp_code", "").strip()

    if not mfa_token or not otp_code:
        return Response(
            {"errors": {"non_field_errors": ["mfa_token y otp_code son requeridos."]}, "status": 400},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        result = services.verify_mfa(
            mfa_token=mfa_token,
            otp_code=otp_code,
            ip=services.get_client_ip(request),
            user_agent=request.META.get("HTTP_USER_AGENT", ""),
        )
    except MFAError as exc:
        return Response(
            {"errors": {"non_field_errors": [str(exc)]}, "status": 401},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    return Response(LoginResponseSerializer(result).data)


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([MFAResendThrottle])
def mfa_resend(request):
    """Generate and email a fresh OTP for an existing MFA challenge."""
    mfa_token = request.data.get("mfa_token", "")

    if not mfa_token:
        return Response(
            {"errors": {"non_field_errors": ["mfa_token es requerido."]}, "status": 400},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        services.resend_mfa(mfa_token=mfa_token, ip=services.get_client_ip(request))
    except MFAError as exc:
        return Response(
            {"errors": {"non_field_errors": [str(exc)]}, "status": 400},
            status=status.HTTP_400_BAD_REQUEST,
        )

    return Response({"detail": "Nuevo código enviado a tu correo."})


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
        return Response(MeSerializer(request.user, context={"request": request}).data)

    serializer = UpdateMeSerializer(data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    user = request.user

    changed: dict = {}
    user_fields = [f for f in ("first_name", "last_name") if f in data]
    for field in user_fields:
        before = getattr(user, field)
        if before != data[field]:
            changed[field] = {"before": before, "after": data[field]}
        setattr(user, field, data[field])
    if user_fields:
        user.save(update_fields=user_fields)

    if "cargo" in data:
        profile, _ = user.profile.__class__.objects.get_or_create(user=user)
        if profile.cargo != data["cargo"]:
            changed["cargo"] = {"before": profile.cargo, "after": data["cargo"]}
        profile.cargo = data["cargo"]
        profile.save(update_fields=["cargo"])

    if changed:
        from apps.reports.audit import log_event
        log_event(
            accion="USER_UPDATED",
            request=request,
            entidad_tipo="User",
            entidad_id=user.pk,
            entidad_nombre=f"{user.get_full_name()} <{user.email}>",
            detalle={"campos": changed},
        )

    return Response(MeSerializer(user, context={"request": request}).data)


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([PasswordResetThrottle])
def password_reset_request(request):
    serializer = PasswordResetRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    try:
        services.request_password_reset(email=serializer.validated_data["email"])
    except LdapUserError as exc:
        return Response(
            {"ldap_user": True, "detail": str(exc)},
            status=status.HTTP_400_BAD_REQUEST,
        )

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
