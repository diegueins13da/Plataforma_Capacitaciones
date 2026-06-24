from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver


class Area(models.Model):
    """Organizational area catalog (TI, Riesgos, Cumplimiento, etc.)."""

    nombre = models.CharField(max_length=150, unique=True, verbose_name="nombre")
    descripcion = models.TextField(blank=True, verbose_name="descripción")
    activo = models.BooleanField(default=True, verbose_name="activo")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="fecha de creación")

    class Meta:
        db_table = "areas"
        verbose_name = "área"
        verbose_name_plural = "áreas"
        ordering = ["nombre"]

    def __str__(self) -> str:
        return self.nombre


class User(AbstractUser):
    class Role(models.TextChoices):
        ADMIN = "ADMIN", "Administrador"
        TRAINER = "TRAINER", "Capacitador"
        USUARIO = "USUARIO", "Usuario"

    email = models.EmailField(unique=True, verbose_name="correo electrónico")
    role = models.CharField(
        max_length=10,
        choices=Role.choices,
        default=Role.USUARIO,
        verbose_name="rol",
    )
    must_change_password = models.BooleanField(
        default=False,
        help_text="Obliga al usuario a cambiar su contraseña en el próximo inicio de sesión.",
    )

    class Meta:
        db_table = "users"
        verbose_name = "usuario"
        verbose_name_plural = "usuarios"

    def __str__(self) -> str:
        return f"{self.get_full_name()} <{self.email}>"


class Group(models.Model):
    """Organizational group for users (e.g. "TI", "Ventas")."""

    nombre = models.CharField(max_length=150, unique=True, verbose_name="nombre")
    descripcion = models.TextField(blank=True, verbose_name="descripción")
    activo = models.BooleanField(default=True, verbose_name="activo")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="fecha de creación")

    class Meta:
        db_table = "groups"
        verbose_name = "grupo"
        verbose_name_plural = "grupos"
        ordering = ["nombre"]

    def __str__(self) -> str:
        return self.nombre


class Cargo(models.Model):
    """Catalog of job positions per area."""

    nombre = models.CharField(max_length=100, verbose_name="cargo")
    area = models.ForeignKey(
        Area,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="cargos",
        verbose_name="área",
    )
    activo = models.BooleanField(default=True, verbose_name="activo")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="fecha de creación")

    class Meta:
        db_table = "cargos"
        unique_together = [("nombre", "area")]
        verbose_name = "cargo"
        verbose_name_plural = "cargos"
        ordering = ["nombre"]

    def __str__(self) -> str:
        return f"{self.nombre} ({self.area})" if self.area else self.nombre


class UserProfile(models.Model):
    AUTH_SOURCE_LOCAL = "LOCAL"
    AUTH_SOURCE_LDAP = "LDAP"

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="profile",
        verbose_name="usuario",
    )
    area = models.ForeignKey(
        Area,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="user_profiles",
        verbose_name="área",
    )
    cargo = models.CharField(max_length=150, blank=True, verbose_name="cargo")
    rubrica = models.ImageField(
        upload_to="rubricas/",
        null=True,
        blank=True,
        verbose_name="rúbrica (firma)",
        help_text="Imagen de la firma del capacitador. Una vez subida no se puede reemplazar.",
    )
    grupo = models.ForeignKey(
        Group,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="members",
        verbose_name="grupo",
    )
    auth_source = models.CharField(
        max_length=10,
        default=AUTH_SOURCE_LOCAL,
        choices=[(AUTH_SOURCE_LOCAL, "Local"), (AUTH_SOURCE_LDAP, "LDAP / AD")],
        verbose_name="origen de autenticación",
        help_text="LOCAL: contraseña local. LDAP: autentica contra Active Directory.",
    )
    ldap_dn = models.TextField(
        blank=True,
        verbose_name="DN en el directorio LDAP",
        help_text="Distinguished Name del usuario en Active Directory (solo lectura).",
    )

    class Meta:
        db_table = "user_profiles"
        verbose_name = "perfil de usuario"
        verbose_name_plural = "perfiles de usuario"

    def __str__(self) -> str:
        return f"Perfil de {self.user}"


# ---------------------------------------------------------------------------
# Signals
# ---------------------------------------------------------------------------


@receiver(post_save, sender=User)
def create_user_profile(sender: type, instance: "User", created: bool, **kwargs: object) -> None:
    """Automatically create a UserProfile when a new User is created."""
    if created:
        UserProfile.objects.get_or_create(user=instance)
