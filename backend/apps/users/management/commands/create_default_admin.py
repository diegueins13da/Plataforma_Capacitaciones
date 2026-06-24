"""
Management command: create_default_admin

Creates a superadmin user on first deploy if none exists.
Safe to run on every container start — it is fully idempotent.

Credentials can be overridden via environment variables:
  ADMIN_EMAIL     (default: admin@lms.local)
  ADMIN_PASSWORD  (default: Admin.2025!)

The user is created with must_change_password=True so the first
login immediately forces a password change before entering the app.
"""
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Create the default superadmin user if no admin exists yet."

    def handle(self, *args, **options):
        from django.conf import settings
        from apps.users.models import User

        # Only create if there is no superuser at all
        if User.objects.filter(is_superuser=True).exists():
            self.stdout.write("Default admin already exists — skipping.")
            return

        import environ
        env = environ.Env()

        email = env("ADMIN_EMAIL", default="admin@lms.local")
        password = env("ADMIN_PASSWORD", default="Admin.2025!")

        user = User.objects.create(
            email=email,
            username="admin",
            first_name="Administrador",
            last_name="LMS",
            role=User.Role.SUPERADMIN,
            is_staff=True,
            is_superuser=True,
            is_active=True,
            must_change_password=True,
        )
        user.set_password(password)
        user.save(update_fields=["password"])

        self.stdout.write(
            self.style.SUCCESS(
                f"Default admin created: {email} "
                f"(must change password on first login)"
            )
        )
