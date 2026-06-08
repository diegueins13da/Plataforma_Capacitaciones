import re

from django.core.exceptions import ValidationError
from django.utils.translation import gettext as _


class PasswordPolicyValidator:
    """
    Corporate password policy:
      - At least 8 characters
      - At least 1 uppercase letter
      - At least 1 digit
      - At least 1 special character
    """

    MIN_LENGTH = 8
    SPECIAL_CHARS = r'[!@#$%^&*(),.?":{}|<>\-_=+\[\]\\;\'`~/]'

    def validate(self, password: str, user=None) -> None:
        errors = []

        if len(password) < self.MIN_LENGTH:
            errors.append(
                _(f"La contraseña debe tener al menos {self.MIN_LENGTH} caracteres.")
            )
        if not re.search(r"[A-Z]", password):
            errors.append(_("La contraseña debe incluir al menos una letra mayúscula."))
        if not re.search(r"[0-9]", password):
            errors.append(_("La contraseña debe incluir al menos un número."))
        if not re.search(self.SPECIAL_CHARS, password):
            errors.append(
                _(
                    "La contraseña debe incluir al menos un carácter especial "
                    '(!@#$%^&*(),.?":{}|<>).'
                )
            )

        if errors:
            raise ValidationError(errors)

    def get_help_text(self) -> str:
        return _(
            f"La contraseña debe tener al menos {self.MIN_LENGTH} caracteres, "
            "una mayúscula, un número y un carácter especial."
        )
