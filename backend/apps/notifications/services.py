"""Notification service — creates in-app notifications. Email delivery in T30."""
from __future__ import annotations

from typing import TYPE_CHECKING

from .models import Notification

if TYPE_CHECKING:
    from apps.users.models import User


def create_notification(
    user: "User",
    tipo: str,
    titulo: str,
    mensaje: str = "",
    referencia_id: int | None = None,
    referencia_tipo: str = "",
) -> Notification:
    return Notification.objects.create(
        user=user,
        tipo=tipo,
        titulo=titulo,
        mensaje=mensaje,
        referencia_id=referencia_id,
        referencia_tipo=referencia_tipo,
    )
