"""
Management command: seed_catalog

Populates the Area / Group (Departamento) / Cargo catalogs with the
organization's official structure. All entries are marked from_ad=True
so they are read-only in the UI (only the AD sync or this command may
change them).

Usage:
    python manage.py seed_catalog
    python manage.py seed_catalog --clear   # delete everything first, then re-seed
"""
from django.core.management.base import BaseCommand

from apps.users.models import Area, Cargo
from apps.users.models import Group as OrgGroup

# ---------------------------------------------------------------------------
# Catalog data
# ---------------------------------------------------------------------------

AREAS = [
    "Dirección",
    "Gerencia",
    "Jurídica",
    "Control",
    "Negocios",
    "Operaciones",
    "Tecnología de Información y Comunicaciones",
    "Financiero",
    "Administrativo",
    "Talento Humano",
]

DEPARTAMENTOS = [
    "Asamblea General",
    "Consejo de Administración",
    "Consejo de Vigilancia",
    "Cuerpos Colegiados",
    "Gerencia",
    "Secretaria",
    "Responsabilidad Social",
    "Asesoría Jurídica",
    "Auditoría Interna",
    "Cumplimiento",
    "Gestión de Riesgos",
    "Seguridad de la Información",
    "Protección de Datos Personales",
    "Seguridad Física y Electrónica",
    "Negocios",
    "Captaciones",
    "Crédito",
    "Cobranza",
    "Conducta de Mercado",
    "Marketing",
    "Agencias",
    "Operaciones",
    "Cajas y Bóvedas",
    "Jefatura de (TIC)",
    "Contabilidad",
    "Tesorería",
    "Jefatura Administrativo",
    "Jefatura de Talento Humano",
]

# (area_nombre, cargo_nombre)
CARGOS = [
    ("Dirección", "Representantes de la Asamblea General"),
    ("Dirección", "Miembros de Consejo de Administración"),
    ("Dirección", "Miembros de Consejo de Vigilancia"),
    ("Dirección", "Miembros de Comités y Comisiones Especiales"),
    ("Gerencia", "Gerente General"),
    ("Gerencia", "Secretaria General"),
    ("Gerencia", "Responsable de Balance Social (Designación)"),
    ("Jurídica", "Asesor Legal"),
    ("Control", "Auditor Interno"),
    ("Control", "Auditor Informático"),
    ("Control", "Asistente de Auditoría Interna"),
    ("Control", "Oficial de Cumplimiento"),
    ("Control", "Oficial de Cumplimiento Suplente"),
    ("Control", "Responsable de la Unidad de Riesgos"),
    ("Control", "Oficial de Riesgo Ambiental y Social (Designación)"),
    ("Control", "Asistente de Riesgos"),
    ("Control", "Oficial de Seguridad de la Información (OSI)"),
    ("Control", "Gestor de Incidentes y Problemas (Designación)"),
    ("Control", "Delegado de Protección de Datos Personales"),
    ("Control", "Oficial de Seguridad Física y Electrónica"),
    ("Negocios", "Jefe de Negocios"),
    ("Negocios", "Supervisor de Negocios (Designación)"),
    ("Negocios", "Coordinador de Captaciones"),
    ("Negocios", "Coordinador de Crédito"),
    ("Negocios", "Coordinador de Cobranza"),
    ("Negocios", "Gestor de Cobranza"),
    ("Negocios", "Responsable de la Gestión de Conducta de Mercado (Designación)"),
    ("Negocios", "Coordinador de Marketing"),
    ("Negocios", "Jefe de Agencia"),
    ("Negocios", "Asesor de Negocios"),
    ("Negocios", "Asistente de Operaciones"),
    ("Negocios", "Administrador de Bóvedas y Cajas (Designación)"),
    ("Negocios", "Cajero"),
    ("Operaciones", "Jefe de Operaciones"),
    ("Operaciones", "Jefe de Cajas y Bóvedas"),
    ("Tecnología de Información y Comunicaciones", "Jefe de Tecnología de Información y Comunicaciones"),
    ("Tecnología de Información y Comunicaciones", "Asistente de Tecnología de la Información y Comunicación (TIC)"),
    ("Financiero", "Contador General"),
    ("Financiero", "Asistente de Contabilidad"),
    ("Financiero", "Tesorero"),
    ("Administrativo", "Jefe Administrativo"),
    ("Administrativo", "Asistente Administrativo"),
    ("Talento Humano", "Jefe de Talento Humano"),
]


class Command(BaseCommand):
    help = "Seed Area / Departamento / Cargo catalogs with the official org structure."

    def add_arguments(self, parser):
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Delete all existing catalog entries before seeding.",
        )

    def handle(self, *args, **options):
        if options["clear"]:
            self.stdout.write("Clearing existing catalog data…")
            Cargo.objects.all().delete()
            OrgGroup.objects.all().delete()
            Area.objects.all().delete()

        # ── Areas ─────────────────────────────────────────────────────────────
        area_created = 0
        area_map: dict[str, Area] = {}
        for nombre in AREAS:
            obj, created = Area.objects.get_or_create(nombre=nombre)
            if created:
                area_created += 1
            if not obj.from_ad:
                obj.from_ad = True
                obj.save(update_fields=["from_ad"])
            area_map[nombre] = obj
        self.stdout.write(f"  Áreas: {area_created} creadas, {len(AREAS) - area_created} ya existían")

        # ── Departamentos ─────────────────────────────────────────────────────
        dep_created = 0
        for nombre in DEPARTAMENTOS:
            obj, created = OrgGroup.objects.get_or_create(nombre=nombre)
            if created:
                dep_created += 1
            if not obj.from_ad:
                obj.from_ad = True
                obj.save(update_fields=["from_ad"])
        self.stdout.write(f"  Departamentos: {dep_created} creados, {len(DEPARTAMENTOS) - dep_created} ya existían")

        # ── Cargos ────────────────────────────────────────────────────────────
        cargo_created = 0
        for area_nombre, cargo_nombre in CARGOS:
            area = area_map.get(area_nombre)
            obj = Cargo.objects.filter(nombre=cargo_nombre, area=area).first()
            if obj is None:
                Cargo.objects.create(nombre=cargo_nombre, area=area, from_ad=True)
                cargo_created += 1
            elif not obj.from_ad:
                obj.from_ad = True
                obj.save(update_fields=["from_ad"])
        self.stdout.write(f"  Cargos: {cargo_created} creados, {len(CARGOS) - cargo_created} ya existían")

        self.stdout.write(self.style.SUCCESS("Catálogo sembrado correctamente."))
