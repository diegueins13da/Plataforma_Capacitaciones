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


class UserProfile(models.Model):
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
    grupo = models.ForeignKey(
        Group,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="members",
        verbose_name="grupo",
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
