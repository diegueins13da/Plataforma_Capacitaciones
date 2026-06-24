"""
Management command: python manage.py ldap_sync

Synchronizes users from Active Directory into the local database.
Requires LDAP_ENABLED=True and the LDAP_* variables to be set in .env.
"""
from django.core.management.base import BaseCommand

from apps.users.ldap_sync import run_ldap_sync


class Command(BaseCommand):
    help = "Sync users from Active Directory (LDAP) into the local database."

    def handle(self, *args, **options):
        self.stdout.write("Starting LDAP sync...")
        try:
            result = run_ldap_sync(admin_user=None, ip="management-command")
        except RuntimeError as exc:
            self.stderr.write(self.style.ERROR(str(exc)))
            return

        self.stdout.write(self.style.SUCCESS(
            f"LDAP sync complete — "
            f"created: {result['created']}, "
            f"updated: {result['updated']}, "
            f"deactivated: {result['deactivated']}, "
            f"skipped: {result['skipped']}, "
            f"errors: {result['errors']}"
        ))

        if result["error_details"]:
            self.stderr.write("\nErrors encountered:")
            for detail in result["error_details"]:
                self.stderr.write(f"  • {detail}")
