from django.contrib.auth.models import AbstractUser
from django.db import models


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


class UserProfile(models.Model):
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="profile",
        verbose_name="usuario",
    )
    area = models.CharField(max_length=150, blank=True, verbose_name="área")
    cargo = models.CharField(max_length=150, blank=True, verbose_name="cargo")
    # grupo FK added in T09b when the Group model exists

    class Meta:
        db_table = "user_profiles"
        verbose_name = "perfil de usuario"
        verbose_name_plural = "perfiles de usuario"

    def __str__(self) -> str:
        return f"Perfil de {self.user}"
