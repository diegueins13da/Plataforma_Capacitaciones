from django.db import migrations


def migrate_virtual_to_hibrido(apps, schema_editor):
    Course = apps.get_model("courses", "Course")
    updated = Course.objects.filter(tipo="VIRTUAL").update(tipo="HIBRIDO")
    if updated:
        print(f"  Migrated {updated} course(s) from tipo=VIRTUAL to tipo=HIBRIDO")


class Migration(migrations.Migration):

    dependencies = [
        ("courses", "0002_temas"),
    ]

    operations = [
        migrations.RunPython(migrate_virtual_to_hibrido, migrations.RunPython.noop),
    ]
