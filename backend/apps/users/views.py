"""
User app views — Group management ViewSet + User management ViewSet.
"""
from django.core.exceptions import ValidationError as DjangoValidationError
from django.shortcuts import get_object_or_404
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action, api_view, parser_classes, permission_classes
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from . import services
from .models import Area, Cargo, Group, User, UserProfile
from .permissions import IsAdmin
from .serializers import (
    AddMembersSerializer,
    AreaSerializer,
    CargoSerializer,
    BulkImportConfirmRequestSerializer,
    BulkImportPreviewResponseSerializer,
    BulkImportCommitResponseSerializer,
    ChangeRoleSerializer,
    GroupMemberSerializer,
    GroupSerializer,
    UserCreateSerializer,
    UserListSerializer,
    UserUpdateSerializer,
)


class AreaViewSet(viewsets.ModelViewSet):
    """
    CRUD endpoints for the Area catalog.
    List/retrieve: any authenticated user. Create/update/delete: ADMIN only.
    """

    queryset = Area.objects.all().order_by("nombre")
    serializer_class = AreaSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsAdmin()]

    def destroy(self, request, *args, **kwargs):
        area = self.get_object()
        if area.user_profiles.exists():
            return Response(
                {"errors": ["No se puede eliminar un área que tiene usuarios asignados."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)


class CargoViewSet(viewsets.ModelViewSet):
    """
    CRUD endpoints for the Cargo catalog.
    List/retrieve: any authenticated user. Create/update/delete: ADMIN only.
    Filter by area: GET /cargos/?area_id=N
    """

    serializer_class = CargoSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsAdmin()]

    def get_queryset(self):
        qs = Cargo.objects.all().select_related("area")
        area_id = self.request.query_params.get("area_id")
        if area_id:
            qs = qs.filter(area_id=area_id)
        return qs

    def destroy(self, request, *args, **kwargs):
        cargo = self.get_object()
        if UserProfile.objects.filter(cargo=cargo.nombre).exists():
            return Response(
                {"errors": ["No se puede eliminar un cargo que está asignado a usuarios."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)


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
        qs = User.objects.select_related("profile__grupo", "profile__area").order_by("first_name", "last_name")
        # Manual filtering (django-filter not configured here; use query params)
        role = self.request.query_params.get("role")
        is_active = self.request.query_params.get("is_active")
        area = self.request.query_params.get("area")
        if role:
            qs = qs.filter(role=role)
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() in ("true", "1", "yes"))
        if area:
            qs = qs.filter(profile__area__nombre__icontains=area)
        return qs

    def list(self, request):
        qs = self.get_queryset()
        # Apply search manually since filter_backends don't activate on GenericViewSet
        search = request.query_params.get("search")
        if search:
            from django.db.models import Q
            for term in search.strip().split():
                qs = qs.filter(
                    Q(first_name__icontains=term)
                    | Q(last_name__icontains=term)
                    | Q(email__icontains=term)
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
        serializer = UserUpdateSerializer(data=request.data, partial=True, context={"user_pk": pk})
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
    def activate(self, request, pk=None):
        user = get_object_or_404(User, pk=pk)
        updated = services.activate_user(
            user,
            admin_user=request.user,
            ip=_get_client_ip(request),
        )
        return Response(UserListSerializer(updated).data)

    @action(detail=True, methods=["post"])
    def deactivate(self, request, pk=None):
        user = get_object_or_404(User, pk=pk)
        try:
            updated = services.deactivate_user(
                user,
                admin_user=request.user,
                ip=_get_client_ip(request),
            )
        except DjangoValidationError as exc:
            msgs = [m for msgs in exc.message_dict.values() for m in msgs]
            return Response({"errors": msgs}, status=status.HTTP_400_BAD_REQUEST)
        return Response(UserListSerializer(updated).data)

    @action(detail=True, methods=["post"], url_path="toggle-mfa")
    def toggle_mfa(self, request, pk=None):
        user = get_object_or_404(User, pk=pk)
        profile = user.profile
        new_value = not profile.mfa_enabled
        profile.mfa_enabled = new_value
        profile.save(update_fields=["mfa_enabled"])
        from apps.reports.audit import log_event
        log_event(
            accion="USER_MFA_TOGGLED",
            actor=request.user,
            ip=_get_client_ip(request),
            entidad_tipo="User",
            entidad_id=user.pk,
            entidad_nombre=f"{user.get_full_name()} <{user.email}>",
            detalle={"mfa_enabled": new_value},
        )
        return Response(UserListSerializer(user).data)

    @action(detail=True, methods=["post"], url_path="reset-lockout")
    def reset_lockout(self, request, pk=None):
        user = get_object_or_404(User, pk=pk)
        try:
            from axes.models import AccessAttempt
            deleted, _ = AccessAttempt.objects.filter(username=user.username).delete()
        except Exception:
            deleted = 0
        from apps.reports.audit import log_event
        log_event(
            accion="LOCKOUT_RESET",
            actor=request.user,
            ip=_get_client_ip(request),
            entidad_tipo="User",
            entidad_id=user.pk,
            entidad_nombre=f"{user.get_full_name()} <{user.email}>",
            detalle={"registros_eliminados": deleted},
        )
        return Response({"detail": "Bloqueo eliminado correctamente."})

    def destroy(self, request, pk=None):
        user = get_object_or_404(User, pk=pk)
        try:
            services.delete_user(
                user,
                admin_user=request.user,
                ip=_get_client_ip(request),
            )
        except DjangoValidationError as exc:
            msgs = [m for msgs in exc.message_dict.values() for m in msgs]
            return Response({"errors": msgs}, status=status.HTTP_400_BAD_REQUEST)
        return Response(status=status.HTTP_204_NO_CONTENT)

    # ------------------------------------------------------------------
    # Bulk import
    # ------------------------------------------------------------------

    # ------------------------------------------------------------------
    # LDAP sync
    # ------------------------------------------------------------------

    @action(detail=False, methods=["post"], url_path="ldap-sync")
    def ldap_sync(self, request):
        """
        POST /users/ldap-sync/
        Trigger a manual synchronization from Active Directory.
        Returns counts of created / updated / deactivated / skipped / errors.
        """
        from apps.config.ldap import get_ldap_config
        if not get_ldap_config().get("enabled"):
            return Response(
                {"errors": ["La integración LDAP no está habilitada. Actívala en Configuración → LDAP."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            from apps.users.ldap_sync import run_ldap_sync
            result = run_ldap_sync(
                admin_user=request.user,
                ip=_get_client_ip(request),
            )
        except RuntimeError as exc:
            return Response({"errors": [str(exc)]}, status=status.HTTP_502_BAD_GATEWAY)

        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"], url_path="catalog-sync")
    def catalog_sync(self, request):
        """
        POST /users/catalog-sync/
        Rebuild Area / Group / Cargo catalogs from Active Directory values.
        Entries absent from AD are deleted (dev-phase policy).
        Returns created/deleted counts per catalog.
        """
        from apps.config.ldap import get_ldap_config
        if not get_ldap_config().get("enabled"):
            return Response(
                {"errors": ["La integración LDAP no está habilitada. Actívala en Configuración → LDAP."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            from apps.users.ldap_sync import run_catalog_sync
            result = run_catalog_sync(
                admin_user=request.user,
                ip=_get_client_ip(request),
            )
        except RuntimeError as exc:
            return Response({"errors": [str(exc)]}, status=status.HTTP_502_BAD_GATEWAY)

        return Response(result, status=status.HTTP_200_OK)

    # ------------------------------------------------------------------
    # Bulk import
    # ------------------------------------------------------------------

    @action(
        detail=False,
        methods=["post"],
        url_path="bulk-import/preview",
        parser_classes=[MultiPartParser],
    )
    def bulk_import_preview(self, request):
        """
        POST /users/bulk-import/preview/
        Accepts multipart/form-data with a single 'file' field (.xlsx).
        Returns a preview: valid rows and rows with errors.
        """
        file = request.FILES.get("file")
        if not file:
            return Response(
                {"file": ["Se requiere adjuntar un archivo."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            result = services.bulk_import_preview(file)
        except DjangoValidationError as exc:
            return Response(exc.message_dict, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            BulkImportPreviewResponseSerializer(result).data,
            status=status.HTTP_200_OK,
        )

    @action(
        detail=False,
        methods=["post"],
        url_path="bulk-import/confirm",
    )
    def bulk_import_confirm(self, request):
        """
        POST /users/bulk-import/confirm/
        Accepts JSON {"rows": [...]} — the valid_rows returned by preview.
        Creates the users and returns a summary.
        """
        serializer = BulkImportConfirmRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = services.bulk_import_commit(
            rows=serializer.validated_data["rows"],
            admin_user=request.user,
            ip=_get_client_ip(request),
        )
        return Response(
            BulkImportCommitResponseSerializer(result).data,
            status=status.HTTP_200_OK,
        )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def generate_rubrica(request):
    """
    POST /v1/users/me/rubrica/generate/
    Auto-generate a signature-like rubrica using Dancing Script font + Bezier flourish.
    """
    from apps.reports.audit import log_event
    from PIL import Image, ImageDraw, ImageFont, ImageFilter
    import io, uuid, math, random
    from django.core.files.base import ContentFile

    if request.user.role != "TRAINER":
        return Response(
            {"detail": "Solo los capacitadores pueden generar rúbricas."},
            status=status.HTTP_403_FORBIDDEN,
        )

    profile = request.user.profile
    name = request.user.get_full_name() or request.user.email.split("@")[0]

    # Seeded RNG so the same user always gets the same style variation
    rng = random.Random(request.user.pk)

    # ── Canvas (2× for antialiasing) ─────────────────────────────────────────
    W, H = 500, 160
    SCALE = 2
    img = Image.new("RGBA", (W * SCALE, H * SCALE), (255, 255, 255, 0))
    draw = ImageDraw.Draw(img)

    # ── Font ─────────────────────────────────────────────────────────────────
    font_size = rng.randint(72, 90) * SCALE
    font_path = "/app/assets/fonts/DancingScript.ttf"
    try:
        font = ImageFont.truetype(font_path, font_size)
    except OSError:
        font = ImageFont.truetype(
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-BoldOblique.ttf", font_size
        )

    # ── Ink color: dark navy, deep indigo, or near-black ─────────────────────
    palettes = [
        (10, 20, 80),    # deep navy
        (5, 5, 5),       # near-black
        (30, 10, 70),    # dark indigo
        (0, 30, 60),     # dark teal-navy
    ]
    r_base, g_base, b_base = palettes[request.user.pk % len(palettes)]
    ink = (r_base, g_base, b_base, 230)
    ink_light = (r_base, g_base, b_base, 140)

    # ── Render name ──────────────────────────────────────────────────────────
    margin_x = 30 * SCALE
    margin_y = 18 * SCALE
    draw.text((margin_x, margin_y), name, fill=ink, font=font)

    # ── Measure text ─────────────────────────────────────────────────────────
    try:
        bbox = draw.textbbox((margin_x, margin_y), name, font=font)
        text_w = bbox[2] - bbox[0]
        text_h = bbox[3] - bbox[1]
        base_y = bbox[3]
    except AttributeError:
        text_w = len(name) * font_size // 2
        text_h = font_size
        base_y = margin_y + text_h

    # ── Bezier flourish underline ─────────────────────────────────────────────
    def draw_bezier_line(pts, steps=120, color=ink_light, width=3):
        def b(t, ps):
            n = len(ps) - 1
            x = y = 0.0
            for i, (px, py) in enumerate(ps):
                c = math.comb(n, i) * (t ** i) * ((1 - t) ** (n - i))
                x += c * px; y += c * py
            return x, y
        prev = b(0, pts)
        for step in range(1, steps + 1):
            curr = b(step / steps, pts)
            draw.line([prev, curr], fill=color, width=width)
            prev = curr

    gap = rng.randint(6, 12) * SCALE
    x0 = margin_x
    x3 = margin_x + text_w + rng.randint(10, 30) * SCALE
    y_line = base_y + gap
    style = rng.randint(0, 2)

    if style == 0:
        # Simple arc underline
        mid_dip = rng.randint(-1, 4) * SCALE
        ctrl_pts = [
            (x0, y_line),
            (x0 + text_w * 0.3, y_line - 6 * SCALE + mid_dip),
            (x0 + text_w * 0.7, y_line + 4 * SCALE),
            (x3, y_line - 2 * SCALE),
        ]
        draw_bezier_line(ctrl_pts, width=3 * SCALE, color=ink_light)

    elif style == 1:
        # Underline with ascending tail
        tail_up = rng.randint(12, 22) * SCALE
        ctrl_pts = [
            (x0, y_line),
            (x0 + text_w * 0.4, y_line + 5 * SCALE),
            (x0 + text_w * 0.75, y_line),
            (x3, y_line - tail_up),
        ]
        draw_bezier_line(ctrl_pts, width=3 * SCALE, color=ink_light)

    else:
        # Double line (main + thin echo)
        ctrl_pts = [
            (x0, y_line),
            (x0 + text_w * 0.5, y_line + rng.randint(3, 8) * SCALE),
            (x3, y_line - rng.randint(2, 6) * SCALE),
        ]
        draw_bezier_line(ctrl_pts, width=3 * SCALE, color=ink_light)
        ctrl_pts2 = [(x + 0, y + 6 * SCALE) for x, y in ctrl_pts]
        draw_bezier_line(ctrl_pts2, width=2 * SCALE, color=(*ink_light[:3], 80))

    # ── Apply subtle ink-bleed: tiny blur then sharpen ───────────────────────
    img = img.filter(ImageFilter.GaussianBlur(radius=1.2))
    img = img.filter(ImageFilter.SHARPEN)

    # ── Slight random rotation (−4° to +2°) ─────────────────────────────────
    angle = rng.uniform(-4, 2)
    img = img.rotate(angle, expand=False, resample=Image.BICUBIC)

    # ── Downscale with LANCZOS for smooth result ─────────────────────────────
    img = img.resize((W, H), Image.LANCZOS)

    # ── Crop to content ───────────────────────────────────────────────────────
    bbox_final = img.getbbox()
    if bbox_final:
        pad = 10
        left = max(0, bbox_final[0] - pad)
        upper = max(0, bbox_final[1] - pad)
        right = min(W, bbox_final[2] + pad)
        lower = min(H, bbox_final[3] + pad)
        img = img.crop((left, upper, right, lower))

    # ── Save ─────────────────────────────────────────────────────────────────
    buf = io.BytesIO()
    img.save(buf, "PNG")
    buf.seek(0)

    if profile.rubrica:
        profile.rubrica.delete(save=False)

    filename = f"auto_{uuid.uuid4().hex[:10]}.png"
    profile.rubrica.save(filename, ContentFile(buf.read()), save=True)

    log_event(
        accion="RUBRICA_AUTO_GENERATED",
        request=request,
        entidad_tipo="User",
        entidad_id=request.user.pk,
        entidad_nombre=f"{request.user.get_full_name()} <{request.user.email}>",
        detalle={"nombre_usado": name},
    )

    return Response(
        {"rubrica_url": profile.rubrica.url},
        status=status.HTTP_200_OK,
    )


def _get_client_ip(request) -> str:
    x_forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if x_forwarded:
        return x_forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "")


class UserDashboardView(APIView):
    """GET /v1/users/me/dashboard/ — all data needed for P06 dashboard."""
    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        from datetime import date as _date, timedelta as _timedelta  # noqa: PLC0415
        import calendar as _calendar  # noqa: PLC0415
        from apps.courses.models import Enrollment, Certificate  # noqa: PLC0415
        from apps.reports.models import AuditLog  # noqa: PLC0415

        enrollments = (
            Enrollment.objects.select_related("course")
            .filter(user=request.user)
            .order_by("course__fecha_limite")
        )

        en_progreso = [e for e in enrollments if e.estado == Enrollment.Estado.EN_PROGRESO]
        completados = [e for e in enrollments if e.estado == Enrollment.Estado.COMPLETADO]
        vencidos = [e for e in enrollments if e.estado == Enrollment.Estado.VENCIDO]

        def enrollment_summary(e: Enrollment) -> dict:
            fl = e.course.fecha_limite
            days_left = (fl - _date.today()).days if fl else None
            urgency = "verde"
            if days_left is not None:
                if days_left <= 1:
                    urgency = "rojo"
                elif days_left <= 7:
                    urgency = "amarillo"
            return {
                "enrollment_id": e.pk,
                "course_id": e.course_id,
                "titulo": e.course.titulo,
                "progreso": e.progreso_porcentaje,
                "fecha_limite": fl,
                "days_left": days_left,
                "urgency": urgency,
                "estado": e.estado,
            }

        def _add_months(d: "_date", months: int) -> "_date":
            m = d.month + months
            y = d.year + (m - 1) // 12
            m = (m - 1) % 12 + 1
            day = min(d.day, _calendar.monthrange(y, m)[1])
            return _date(y, m, day)

        all_certs = list(
            Certificate.objects
            .select_related("course")
            .filter(user=request.user)
            .order_by("-fecha_emision")
        )
        today = _date.today()
        in_90 = today + _timedelta(days=90)
        certs_por_vencer = 0
        recent_certs = []
        for i, c in enumerate(all_certs):
            meses = c.course.cert_expira_meses
            fecha_venc = _add_months(c.fecha_emision.date(), meses) if meses else None
            if fecha_venc and today <= fecha_venc <= in_90:
                certs_por_vencer += 1
            if i < 3:
                recent_certs.append({
                    "id": str(c.pk),
                    "titulo": c.course.titulo,
                    "fecha_emision": c.fecha_emision.date(),
                    "fecha_vencimiento": fecha_venc,
                })

        completados_sorted = sorted(
            completados,
            key=lambda e: e.fecha_completado.timestamp() if e.fecha_completado else 0,
            reverse=True,
        )
        recent_completados = [
            {
                "enrollment_id": e.pk,
                "course_id": e.course_id,
                "titulo": e.course.titulo,
                "fecha_completado": e.fecha_completado.date() if e.fecha_completado else None,
            }
            for e in completados_sorted[:2]
        ]

        recent_log = (
            AuditLog.objects.filter(user=request.user)
            .order_by("-timestamp")
            .values("accion", "timestamp", "ip", "entidad_nombre", "entidad_tipo")[:5]
        )

        return Response({
            "resumen": {
                "en_progreso": len(en_progreso),
                "completados": len(completados),
                "vencidos": len(vencidos),
                "certificados": len(all_certs),
                "certs_por_vencer": certs_por_vencer,
            },
            "cursos_activos": [enrollment_summary(e) for e in en_progreso],
            "cursos_completados": recent_completados,
            "proximos_vencimientos": [
                enrollment_summary(e)
                for e in en_progreso
                if e.course.fecha_limite is not None
            ][:5],
            "certificados": recent_certs,
            "actividad_reciente": list(recent_log),
        })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser])
def upload_rubrica(request):
    """
    POST /v1/users/me/rubrica/
    Upload or replace the trainer's signature image.
    """
    from apps.reports.audit import log_event

    profile = request.user.profile
    is_replacement = bool(profile.rubrica)

    file = request.FILES.get("rubrica") or request.FILES.get("file")
    if not file:
        return Response(
            {"detail": "Se requiere adjuntar un archivo de imagen."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    allowed_types = {"image/png", "image/jpeg", "image/jpg", "image/webp"}
    if file.content_type not in allowed_types:
        return Response(
            {"detail": "Formato no permitido. Use PNG, JPG o WebP."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if file.size > 5 * 1024 * 1024:
        return Response(
            {"detail": "La imagen no puede superar 5 MB."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if is_replacement:
        profile.rubrica.delete(save=False)

    profile.rubrica = file
    profile.save(update_fields=["rubrica"])

    log_event(
        accion="RUBRICA_REPLACED" if is_replacement else "RUBRICA_UPLOADED",
        request=request,
        entidad_tipo="User",
        entidad_id=request.user.pk,
        entidad_nombre=f"{request.user.get_full_name()} <{request.user.email}>",
    )

    return Response({"rubrica_url": profile.rubrica.url}, status=status.HTTP_200_OK)
