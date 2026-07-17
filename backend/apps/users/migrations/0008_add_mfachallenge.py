import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0007_userprofile_auth_source_ldap_dn"),
    ]

    operations = [
        migrations.CreateModel(
            name="MFAChallenge",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("token", models.UUIDField(db_index=True, default=uuid.uuid4, editable=False, unique=True)),
                ("otp_hash", models.CharField(max_length=64)),
                ("salt", models.UUIDField(default=uuid.uuid4, editable=False)),
                ("attempts", models.PositiveSmallIntegerField(default=0)),
                ("is_used", models.BooleanField(default=False)),
                ("expires_at", models.DateTimeField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("ip_address", models.GenericIPAddressField(blank=True, null=True)),
                ("user_agent", models.TextField(blank=True)),
                ("resend_count", models.PositiveSmallIntegerField(default=0)),
                ("last_resend_at", models.DateTimeField(blank=True, null=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="mfa_challenges",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="usuario",
                    ),
                ),
            ],
            options={
                "verbose_name": "desafío MFA",
                "verbose_name_plural": "desafíos MFA",
                "db_table": "mfa_challenges",
            },
        ),
        migrations.AddIndex(
            model_name="mfachallenge",
            index=models.Index(fields=["token"], name="mfa_challen_token_idx"),
        ),
        migrations.AddIndex(
            model_name="mfachallenge",
            index=models.Index(fields=["user", "is_used"], name="mfa_challen_user_used_idx"),
        ),
    ]
