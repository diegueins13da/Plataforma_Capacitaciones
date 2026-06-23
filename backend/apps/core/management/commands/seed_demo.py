"""
Management command: seed_demo
Creates realistic demo data to showcase all LMS platform features.
Safe to run multiple times — uses get_or_create throughout.
"""
from __future__ import annotations

import uuid
from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth.hashers import make_password
from django.core.management.base import BaseCommand
from django.utils import timezone


class Command(BaseCommand):
    help = "Populate the database with demo data for platform showcase."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Delete all demo data before seeding (keeps admin@empresa.com).",
        )

    def handle(self, *args, **options):
        if options["reset"]:
            self._reset()

        self.stdout.write("Creando datos de demostración...\n")

        areas = self._create_areas()
        groups = self._create_groups()
        users = self._create_users(areas, groups)
        courses = self._create_courses(areas, groups, users)
        self._create_enrollments(users, courses)

        self.stdout.write(self.style.SUCCESS("\n✓ Seed completado exitosamente.\n"))
        self._print_summary(users, courses)

    # -----------------------------------------------------------------------
    # Reset
    # -----------------------------------------------------------------------

    def _reset(self):
        from apps.assessments.models import Assessment, Question, UserAnswer
        from apps.courses.models import Certificate, Course, Enrollment, Module, ModuleProgress
        from apps.users.models import User

        self.stdout.write("Eliminando datos de demo previos...")
        demo_emails = [
            "instructor@empresa.com",
            "ana.garcia@empresa.com",
            "pedro.lopez@empresa.com",
            "maria.rodriguez@empresa.com",
            "jose.martinez@empresa.com",
            "laura.sanchez@empresa.com",
        ]
        demo_course_titles = [
            "Seguridad de la Información - ISO 27001",
            "Prevención de Riesgos Laborales",
            "Excel Avanzado para Gestión",
            "Inducción Corporativa 2025",
            "Liderazgo y Gestión de Equipos",
        ]
        # Delete courses first (cascade removes modules, enrollments, etc.)
        Course.objects.filter(titulo__in=demo_course_titles).delete()
        User.objects.filter(email__in=demo_emails).delete()
        self.stdout.write("  Datos eliminados.\n")

    # -----------------------------------------------------------------------
    # Areas
    # -----------------------------------------------------------------------

    def _create_areas(self):
        from apps.users.models import Area

        data = [
            ("Seguridad de la Información", "Gestión de ciberseguridad y protección de datos"),
            ("Recursos Humanos", "Gestión del talento humano y capacitación"),
            ("Operaciones", "Procesos operativos, logística y producción"),
            ("Ventas y Comercial", "Fuerza de ventas y atención al cliente"),
            ("Finanzas y Contabilidad", "Control financiero y reportes"),
        ]
        areas = {}
        for nombre, descripcion in data:
            obj, created = Area.objects.get_or_create(
                nombre=nombre,
                defaults={"descripcion": descripcion, "activo": True},
            )
            areas[nombre] = obj
            mark = "+" if created else "·"
            self.stdout.write(f"  {mark} Área: {nombre}")
        return areas

    # -----------------------------------------------------------------------
    # Groups
    # -----------------------------------------------------------------------

    def _create_groups(self):
        from apps.users.models import Group

        data = [
            ("Supervisores", "Jefes y supervisores de área"),
            ("Equipo Técnico", "Personal técnico y de sistemas"),
            ("Equipo Comercial", "Fuerza de ventas y comerciales"),
        ]
        groups = {}
        for nombre, descripcion in data:
            obj, created = Group.objects.get_or_create(
                nombre=nombre,
                defaults={"descripcion": descripcion, "activo": True},
            )
            groups[nombre] = obj
            mark = "+" if created else "·"
            self.stdout.write(f"  {mark} Grupo: {nombre}")
        return groups

    # -----------------------------------------------------------------------
    # Users
    # -----------------------------------------------------------------------

    def _create_users(self, areas, groups):
        from apps.users.models import User

        hashed = make_password("Demo1234!")

        user_data = [
            {
                "email": "instructor@empresa.com",
                "username": "instructor",
                "first_name": "Carlos",
                "last_name": "Mendoza",
                "role": "TRAINER",
                "cargo": "Instructor Senior",
                "area": areas["Recursos Humanos"],
                "group": groups["Supervisores"],
            },
            {
                "email": "ana.garcia@empresa.com",
                "username": "ana.garcia",
                "first_name": "Ana",
                "last_name": "García",
                "role": "USUARIO",
                "cargo": "Analista de Seguridad",
                "area": areas["Seguridad de la Información"],
                "group": groups["Equipo Técnico"],
            },
            {
                "email": "pedro.lopez@empresa.com",
                "username": "pedro.lopez",
                "first_name": "Pedro",
                "last_name": "López",
                "role": "USUARIO",
                "cargo": "Supervisor de Operaciones",
                "area": areas["Operaciones"],
                "group": groups["Supervisores"],
            },
            {
                "email": "maria.rodriguez@empresa.com",
                "username": "maria.rodriguez",
                "first_name": "María",
                "last_name": "Rodríguez",
                "role": "USUARIO",
                "cargo": "Ejecutiva de Ventas",
                "area": areas["Ventas y Comercial"],
                "group": groups["Equipo Comercial"],
            },
            {
                "email": "jose.martinez@empresa.com",
                "username": "jose.martinez",
                "first_name": "José",
                "last_name": "Martínez",
                "role": "USUARIO",
                "cargo": "Analista Financiero",
                "area": areas["Finanzas y Contabilidad"],
                "group": groups["Equipo Técnico"],
            },
            {
                "email": "laura.sanchez@empresa.com",
                "username": "laura.sanchez",
                "first_name": "Laura",
                "last_name": "Sánchez",
                "role": "USUARIO",
                "cargo": "Coordinadora de RRHH",
                "area": areas["Recursos Humanos"],
                "group": groups["Supervisores"],
            },
        ]

        users = {}
        for data in user_data:
            area = data.pop("area")
            group = data.pop("group")
            cargo = data.pop("cargo")

            user, created = User.objects.get_or_create(
                email=data["email"],
                defaults={**data, "password": hashed, "is_active": True},
            )
            # Update profile
            profile = user.profile
            profile.cargo = cargo
            profile.area = area
            profile.grupo = group
            profile.save(update_fields=["cargo", "area", "grupo"])

            users[data["email"]] = user
            mark = "+" if created else "·"
            self.stdout.write(f"  {mark} Usuario: {user.get_full_name()} ({user.role})")

        return users

    # -----------------------------------------------------------------------
    # Courses + Modules + Assessments
    # -----------------------------------------------------------------------

    def _create_courses(self, areas, groups, users):
        from apps.assessments.models import Assessment, Question
        from apps.courses.models import Course, Module
        from apps.users.models import User

        instructor = users["instructor@empresa.com"]
        admin = User.objects.filter(email="admin@empresa.com").first()

        today = date.today()
        courses = {}

        # --- Course 1: ISO 27001 ---
        c1, _ = Course.objects.get_or_create(
            titulo="Seguridad de la Información - ISO 27001",
            defaults={
                "descripcion": (
                    "Curso completo sobre la norma ISO 27001 para la gestión de la seguridad "
                    "de la información. Aprende a implementar un SGSI en tu organización, "
                    "identificar activos, gestionar riesgos y prepararte para la certificación."
                ),
                "tipo": "ONLINE",
                "estado": "PUBLICADO",
                "instructor": instructor,
                "area": areas["Seguridad de la Información"],
                "duracion_horas": 20,
                "cert_expira_meses": 12,
                "fecha_limite": today + timedelta(days=60),
                "version": "2.1",
            },
        )
        c1.audiencia_grupos.add(groups["Equipo Técnico"], groups["Supervisores"])
        courses["iso27001"] = c1
        self.stdout.write(f"  + Curso: {c1.titulo}")

        modules_iso = [
            (
                "Introducción a la Seguridad de la Información",
                "TEXTO",
                30,
                """<h2>¿Qué es la Seguridad de la Información?</h2>
<p>La seguridad de la información abarca la protección de datos contra acceso no autorizado,
divulgación, alteración o destrucción. La <strong>norma ISO 27001</strong> proporciona un marco
sistemático para gestionar esta seguridad.</p>
<h3>Principios fundamentales (CIA)</h3>
<ul>
  <li><strong>Confidencialidad:</strong> Solo personas autorizadas acceden a la información.</li>
  <li><strong>Integridad:</strong> La información es completa y no ha sido alterada.</li>
  <li><strong>Disponibilidad:</strong> La información está accesible cuando se necesita.</li>
</ul>
<h3>¿Por qué implementar ISO 27001?</h3>
<p>Las organizaciones que implementan ISO 27001 reducen el riesgo de incidentes de seguridad
en un 60% y generan confianza con clientes y socios estratégicos.</p>""",
            ),
            (
                "Inventario y Clasificación de Activos",
                "TEXTO",
                45,
                """<h2>Gestión de Activos de Información</h2>
<p>El Anexo A de ISO 27001 requiere identificar todos los activos de información y asignarles
un propietario responsable de su protección.</p>
<h3>Tipos de activos</h3>
<ul>
  <li><strong>Información:</strong> Bases de datos, contratos, políticas, registros de clientes.</li>
  <li><strong>Software:</strong> Aplicaciones, sistemas operativos, herramientas de desarrollo.</li>
  <li><strong>Hardware:</strong> Servidores, laptops, dispositivos móviles, equipos de red.</li>
  <li><strong>Servicios:</strong> Conectividad, energía eléctrica, servicios en la nube.</li>
  <li><strong>Personas:</strong> Habilidades, conocimiento del personal clave.</li>
</ul>
<h3>Clasificación por nivel de sensibilidad</h3>
<p>Los activos se clasifican en: <em>Público, Interno, Confidencial</em> y <em>Secreto</em>,
según el impacto potencial de su divulgación no autorizada.</p>""",
            ),
            (
                "Evaluación y Tratamiento de Riesgos",
                "TEXTO",
                60,
                """<h2>Metodología de Gestión de Riesgos ISO 27005</h2>
<p>La gestión de riesgos es el corazón de ISO 27001. El proceso sigue el ciclo:</p>
<ol>
  <li><strong>Identificación:</strong> ¿Qué puede salir mal?</li>
  <li><strong>Análisis:</strong> ¿Cuál es la probabilidad e impacto?</li>
  <li><strong>Evaluación:</strong> ¿Es aceptable el riesgo?</li>
  <li><strong>Tratamiento:</strong> Mitigar, transferir, aceptar o eliminar.</li>
</ol>
<h3>Cálculo de riesgo</h3>
<p><code>Riesgo = Probabilidad × Impacto</code></p>
<p>Se utiliza una matriz de 5×5 donde el riesgo alto (≥12) requiere tratamiento inmediato,
el riesgo medio (6-11) requiere plan de acción, y el riesgo bajo (≤5) puede aceptarse.</p>""",
            ),
            (
                "Controles de Seguridad y Declaración de Aplicabilidad",
                "TEXTO",
                45,
                """<h2>Los 114 Controles del Anexo A</h2>
<p>ISO 27001:2013 define 114 controles distribuidos en 14 dominios. La organización debe
documentar cuáles aplica y por qué en la <strong>Declaración de Aplicabilidad (SoA)</strong>.</p>
<h3>Dominios principales</h3>
<ul>
  <li>A.5 - Políticas de seguridad</li>
  <li>A.6 - Organización de la seguridad</li>
  <li>A.7 - Seguridad de recursos humanos</li>
  <li>A.8 - Gestión de activos</li>
  <li>A.9 - Control de accesos</li>
  <li>A.10 - Criptografía</li>
  <li>A.11 - Seguridad física y del entorno</li>
  <li>A.12 - Seguridad en operaciones</li>
</ul>
<p>La versión ISO 27001:2022 actualiza este marco a 93 controles en 4 temas.</p>""",
            ),
        ]
        self._create_modules(c1, modules_iso)

        # Assessment for ISO 27001
        assessment1, _ = Assessment.objects.get_or_create(
            course=c1,
            defaults={
                "puntaje_minimo": 70,
                "max_intentos": 3,
                "tiempo_limite_minutos": 30,
            },
        )
        self._create_questions_iso(assessment1)

        # --- Course 2: Prevención de Riesgos ---
        c2, _ = Course.objects.get_or_create(
            titulo="Prevención de Riesgos Laborales",
            defaults={
                "descripcion": (
                    "Aprende a identificar, evaluar y controlar los riesgos en el lugar de trabajo. "
                    "Cumple con la normativa legal vigente y protege la salud de tu equipo."
                ),
                "tipo": "HIBRIDO",
                "estado": "PUBLICADO",
                "instructor": instructor,
                "area": areas["Operaciones"],
                "duracion_horas": 12,
                "cert_expira_meses": 24,
                "fecha_limite": today + timedelta(days=30),
                "version": "1.3",
            },
        )
        c2.audiencia_grupos.add(groups["Supervisores"], groups["Equipo Comercial"])
        courses["prevencion"] = c2
        self.stdout.write(f"  + Curso: {c2.titulo}")

        modules_prev = [
            (
                "Marco Legal de Seguridad y Salud en el Trabajo",
                "TEXTO",
                25,
                """<h2>Normativa vigente en materia de SST</h2>
<p>La Ley de Prevención de Riesgos Laborales establece las obligaciones del empleador
y los derechos del trabajador en materia de seguridad y salud.</p>
<h3>Obligaciones del empleador</h3>
<ul>
  <li>Elaborar un Plan de Prevención de Riesgos.</li>
  <li>Realizar evaluaciones periódicas de riesgos.</li>
  <li>Proporcionar EPP (Equipos de Protección Personal) adecuados.</li>
  <li>Informar y formar a los trabajadores.</li>
  <li>Investigar accidentes e incidentes de trabajo.</li>
</ul>""",
            ),
            (
                "Identificación de Peligros y Evaluación de Riesgos",
                "TEXTO",
                40,
                """<h2>Metodología IPER</h2>
<p>La Identificación de Peligros y Evaluación de Riesgos (IPER) es la base de toda gestión
preventiva. Se aplica la metodología:</p>
<h3>Paso a paso</h3>
<ol>
  <li><strong>Identificar el peligro:</strong> ¿Qué puede causar daño?</li>
  <li><strong>Identificar quién puede resultar dañado:</strong> trabajadores, visitantes, contratistas.</li>
  <li><strong>Evaluar el riesgo:</strong> Probabilidad × Severidad.</li>
  <li><strong>Implementar controles:</strong> Jerarquía de controles (eliminar, sustituir, controles ingenieriles, administrativos, EPP).</li>
  <li><strong>Revisar y actualizar:</strong> La evaluación es dinámica.</li>
</ol>""",
            ),
            (
                "Actuación ante Emergencias y Primeros Auxilios",
                "TEXTO",
                35,
                """<h2>Plan de Emergencias</h2>
<p>Toda organización debe contar con un Plan de Emergencias que establezca los procedimientos
de respuesta ante incidentes como incendios, terremotos, evacuaciones o accidentes graves.</p>
<h3>Componentes del Plan</h3>
<ul>
  <li>Organización de brigadas (evacuación, primeros auxilios, contra incendios).</li>
  <li>Rutas de evacuación señalizadas.</li>
  <li>Puntos de encuentro definidos.</li>
  <li>Procedimientos de comunicación con servicios de emergencia.</li>
  <li>Simulacros periódicos (mínimo 1 por año).</li>
</ul>""",
            ),
        ]
        self._create_modules(c2, modules_prev)

        assessment2, _ = Assessment.objects.get_or_create(
            course=c2,
            defaults={
                "puntaje_minimo": 75,
                "max_intentos": 2,
                "tiempo_limite_minutos": 20,
            },
        )
        self._create_questions_prevencion(assessment2)

        # --- Course 3: Excel ---
        c3, _ = Course.objects.get_or_create(
            titulo="Excel Avanzado para Gestión",
            defaults={
                "descripcion": (
                    "Domina las funciones avanzadas de Excel para análisis de datos, "
                    "creación de dashboards, tablas dinámicas y automatización con macros."
                ),
                "tipo": "ONLINE",
                "estado": "PUBLICADO",
                "instructor": instructor,
                "area": areas["Recursos Humanos"],
                "duracion_horas": 16,
                "cert_expira_meses": None,
                "fecha_limite": today + timedelta(days=90),
                "version": "1.0",
            },
        )
        c3.audiencia_grupos.add(
            groups["Equipo Técnico"], groups["Equipo Comercial"], groups["Supervisores"]
        )
        courses["excel"] = c3
        self.stdout.write(f"  + Curso: {c3.titulo}")

        modules_excel = [
            (
                "Funciones Avanzadas: BUSCARV, ÍNDICE y COINCIDIR",
                "TEXTO",
                50,
                """<h2>Búsqueda y referencia avanzada en Excel</h2>
<p>Las funciones de búsqueda son fundamentales para trabajar con grandes volúmenes de datos.</p>
<h3>BUSCARV (VLOOKUP)</h3>
<p><code>=BUSCARV(valor_buscado, rango, número_columna, [exacto])</code></p>
<p>Busca un valor en la primera columna de un rango y devuelve el valor en la misma fila
de la columna especificada. Limitación: solo busca de izquierda a derecha.</p>
<h3>ÍNDICE + COINCIDIR</h3>
<p>Combinación más poderosa: <code>=ÍNDICE(rango_resultado, COINCIDIR(valor, rango_búsqueda, 0))</code></p>
<p>Ventaja: busca en cualquier dirección y es más eficiente con grandes datasets.</p>""",
            ),
            (
                "Tablas Dinámicas y Gráficos Dinámicos",
                "TEXTO",
                60,
                """<h2>Análisis de datos con Tablas Dinámicas</h2>
<p>Las Tablas Dinámicas permiten resumir, analizar y explorar datos de forma interactiva
sin escribir fórmulas complejas.</p>
<h3>Pasos para crear una Tabla Dinámica</h3>
<ol>
  <li>Seleccionar el rango de datos (incluyendo encabezados).</li>
  <li>Insertar → Tabla Dinámica.</li>
  <li>Arrastrar campos a Filas, Columnas, Valores y Filtros.</li>
  <li>Configurar el tipo de cálculo (suma, conteo, promedio, etc.).</li>
</ol>
<h3>Segmentaciones y Escala de tiempo</h3>
<p>Agrega filtros visuales interactivos para hacer dashboards más dinámicos.</p>""",
            ),
            (
                "Automatización con Macros y VBA básico",
                "TEXTO",
                70,
                """<h2>Introducción a VBA para Excel</h2>
<p>Visual Basic for Applications (VBA) permite automatizar tareas repetitivas en Excel.
Las macros son secuencias de instrucciones que se ejecutan automáticamente.</p>
<h3>Grabar una macro</h3>
<ol>
  <li>Vista → Macros → Grabar macro.</li>
  <li>Nombrar la macro y asignar un atajo de teclado.</li>
  <li>Ejecutar las acciones que quieres automatizar.</li>
  <li>Detener la grabación.</li>
</ol>
<h3>Estructura básica VBA</h3>
<pre>Sub FormatearReporte()
    Range("A1:Z1").Font.Bold = True
    Range("A1:Z1").Interior.Color = RGB(0, 112, 192)
    Columns.AutoFit
End Sub</pre>""",
            ),
        ]
        self._create_modules(c3, modules_excel)

        # --- Course 4: Inducción ---
        c4, _ = Course.objects.get_or_create(
            titulo="Inducción Corporativa 2025",
            defaults={
                "descripcion": (
                    "Bienvenido a la empresa. Este curso te presenta nuestra cultura, "
                    "valores, políticas internas, estructura organizacional y beneficios."
                ),
                "tipo": "ONLINE",
                "estado": "PUBLICADO",
                "instructor": admin or instructor,
                "area": areas["Recursos Humanos"],
                "duracion_horas": 4,
                "cert_expira_meses": None,
                "fecha_limite": None,
                "version": "2025.1",
            },
        )
        c4.audiencia_grupos.add(
            groups["Equipo Técnico"], groups["Equipo Comercial"], groups["Supervisores"]
        )
        courses["induccion"] = c4
        self.stdout.write(f"  + Curso: {c4.titulo}")

        modules_ind = [
            (
                "Historia, Misión, Visión y Valores",
                "TEXTO",
                20,
                """<h2>Nuestra Historia</h2>
<p>Fundada en 2005, la empresa nació con la misión de transformar la capacitación corporativa
en Latinoamérica mediante tecnología e innovación pedagógica.</p>
<h3>Misión</h3>
<p><em>"Potenciar el talento humano de las organizaciones a través de soluciones de aprendizaje
efectivas, accesibles y medibles."</em></p>
<h3>Visión 2030</h3>
<p>Ser la plataforma de capacitación corporativa líder en la región, con presencia en
15 países y más de 500,000 usuarios activos.</p>
<h3>Nuestros valores</h3>
<ul>
  <li>🎯 <strong>Excelencia:</strong> Hacemos cada cosa bien, o no la hacemos.</li>
  <li>🤝 <strong>Integridad:</strong> Actuamos con transparencia y honestidad.</li>
  <li>🚀 <strong>Innovación:</strong> Cuestionamos el status quo constantemente.</li>
  <li>👥 <strong>Colaboración:</strong> Los mejores resultados se logran en equipo.</li>
</ul>""",
            ),
            (
                "Políticas Internas y Código de Conducta",
                "TEXTO",
                25,
                """<h2>Políticas Fundamentales</h2>
<h3>Horario y asistencia</h3>
<p>El horario laboral es de lunes a viernes, 8:00 a 17:30 hrs con una hora de almuerzo.
El teletrabajo está disponible hasta 2 días por semana previa coordinación con el jefe directo.</p>
<h3>Uso de recursos tecnológicos</h3>
<p>Los equipos y sistemas de la empresa se utilizan exclusivamente para fines laborales.
Está prohibido el uso de software no licenciado y el acceso a sitios no autorizados.</p>
<h3>Confidencialidad</h3>
<p>Toda la información de clientes, procesos internos y datos financieros es confidencial.
El empleado firmará el acuerdo de confidencialidad al inicio de su relación laboral.</p>""",
            ),
            (
                "Estructura Organizacional y Beneficios",
                "TEXTO",
                15,
                """<h2>Organigrama</h2>
<p>La empresa está organizada en 5 gerencias: Comercial, Operaciones, Tecnología,
Recursos Humanos y Finanzas, todas reportando a la Dirección General.</p>
<h3>Beneficios del colaborador</h3>
<ul>
  <li>📚 Acceso ilimitado a la plataforma de capacitación.</li>
  <li>🏥 Seguro médico complementario desde el primer día.</li>
  <li>🎂 Día libre en tu cumpleaños.</li>
  <li>💻 Equipo de trabajo de última generación.</li>
  <li>🏡 Teletrabajo flexible (2 días/semana).</li>
  <li>📈 Bono anual por desempeño (hasta 2 salarios mensuales).</li>
</ul>""",
            ),
        ]
        self._create_modules(c4, modules_ind)

        # --- Course 5: Liderazgo (BORRADOR) ---
        c5, _ = Course.objects.get_or_create(
            titulo="Liderazgo y Gestión de Equipos",
            defaults={
                "descripcion": (
                    "Desarrolla competencias de liderazgo moderno: comunicación efectiva, "
                    "delegación, feedback y gestión del cambio. En desarrollo — próximo lanzamiento."
                ),
                "tipo": "HIBRIDO",
                "estado": "BORRADOR",
                "instructor": instructor,
                "area": areas["Recursos Humanos"],
                "duracion_horas": 24,
                "cert_expira_meses": 18,
                "version": "0.5",
            },
        )
        c5.audiencia_grupos.add(groups["Supervisores"])
        courses["liderazgo"] = c5
        self.stdout.write(f"  + Curso: {c5.titulo} (BORRADOR)")

        return courses

    # -----------------------------------------------------------------------
    # Modules helper
    # -----------------------------------------------------------------------

    def _create_modules(self, course, modules_data):
        from apps.courses.models import Module

        for orden, (titulo, tipo, duracion, contenido) in enumerate(modules_data, start=1):
            Module.objects.get_or_create(
                course=course,
                titulo=titulo,
                defaults={
                    "tipo_contenido": tipo,
                    "orden": orden,
                    "duracion_minutos": duracion,
                    "contenido_html": contenido,
                    "es_secuencial": True,
                },
            )

    # -----------------------------------------------------------------------
    # Questions
    # -----------------------------------------------------------------------

    def _create_questions_iso(self, assessment):
        from apps.assessments.models import Question

        questions = [
            {
                "texto": "¿Cuáles son los tres principios fundamentales de la seguridad de la información según ISO 27001?",
                "tipo": "MULTIPLE_CHOICE",
                "opciones": [
                    "Confidencialidad, Integridad, Disponibilidad",
                    "Autenticación, Autorización, Auditoría",
                    "Prevención, Detección, Respuesta",
                    "Cifrado, Firewalls, Antivirus",
                ],
                "respuesta_correcta": 0,
                "orden": 1,
            },
            {
                "texto": "¿Qué es la Declaración de Aplicabilidad (SoA) en ISO 27001?",
                "tipo": "MULTIPLE_CHOICE",
                "opciones": [
                    "Un documento que lista todos los incidentes de seguridad del año",
                    "Un documento que indica qué controles del Anexo A aplica la organización y por qué",
                    "El contrato de auditoría con el organismo certificador",
                    "La política de seguridad de la información de la empresa",
                ],
                "respuesta_correcta": 1,
                "orden": 2,
            },
            {
                "texto": "¿Cuál es la fórmula correcta para calcular el nivel de riesgo en una metodología estándar?",
                "tipo": "MULTIPLE_CHOICE",
                "opciones": [
                    "Riesgo = Amenaza + Vulnerabilidad",
                    "Riesgo = Impacto / Probabilidad",
                    "Riesgo = Probabilidad × Impacto",
                    "Riesgo = Activo - Control",
                ],
                "respuesta_correcta": 2,
                "orden": 3,
            },
            {
                "texto": "¿Cuántos controles de seguridad define el Anexo A de ISO 27001:2013?",
                "tipo": "MULTIPLE_CHOICE",
                "opciones": ["93", "114", "130", "78"],
                "respuesta_correcta": 1,
                "orden": 4,
            },
            {
                "texto": "La ISO 27001 es una norma obligatoria para todas las empresas en Latinoamérica.",
                "tipo": "TRUE_FALSE",
                "opciones": ["Verdadero", "Falso"],
                "respuesta_correcta": False,
                "orden": 5,
            },
            {
                "texto": "¿Qué tipos de activos de información deben incluirse en el inventario según ISO 27001?",
                "tipo": "MULTIPLE_SELECT",
                "opciones": [
                    "Información (bases de datos, contratos)",
                    "Software y aplicaciones",
                    "Hardware y equipos",
                    "Personas con conocimiento clave",
                ],
                "respuesta_correcta": [0, 1, 2, 3],
                "orden": 6,
            },
            {
                "texto": "¿Cuál de las siguientes opciones NO es una opción de tratamiento del riesgo en ISO 27001?",
                "tipo": "MULTIPLE_CHOICE",
                "opciones": ["Mitigar el riesgo", "Transferir el riesgo", "Ignorar el riesgo", "Aceptar el riesgo"],
                "respuesta_correcta": 2,
                "orden": 7,
            },
            {
                "texto": "El ciclo PDCA (Planificar-Hacer-Verificar-Actuar) es la base del SGSI en ISO 27001.",
                "tipo": "TRUE_FALSE",
                "opciones": ["Verdadero", "Falso"],
                "respuesta_correcta": True,
                "orden": 8,
            },
        ]

        for q_data in questions:
            Question.objects.get_or_create(
                assessment=assessment,
                texto=q_data["texto"],
                defaults={
                    "tipo": q_data["tipo"],
                    "opciones": q_data["opciones"],
                    "respuesta_correcta": q_data["respuesta_correcta"],
                    "orden": q_data["orden"],
                    "aprobada_por_humano": True,
                },
            )
        self.stdout.write(f"    + {len(questions)} preguntas para {assessment.course.titulo}")

    def _create_questions_prevencion(self, assessment):
        from apps.assessments.models import Question

        questions = [
            {
                "texto": "¿Cuál es la jerarquía correcta de controles en prevención de riesgos laborales (de mayor a menor efectividad)?",
                "tipo": "MULTIPLE_CHOICE",
                "opciones": [
                    "EPP → Administrativos → Ingenieriles → Sustitución → Eliminación",
                    "Eliminación → Sustitución → Controles Ingenieriles → Administrativos → EPP",
                    "Administrativos → EPP → Ingenieriles → Eliminación",
                    "EPP → Eliminación → Sustitución",
                ],
                "respuesta_correcta": 1,
                "orden": 1,
            },
            {
                "texto": "¿Con qué frecuencia mínima se deben realizar simulacros de emergencia según buenas prácticas?",
                "tipo": "MULTIPLE_CHOICE",
                "opciones": ["Cada 5 años", "Cada 3 años", "Una vez al año", "Cada 6 meses"],
                "respuesta_correcta": 2,
                "orden": 2,
            },
            {
                "texto": "¿Cuáles son obligaciones del empleador en materia de SST?",
                "tipo": "MULTIPLE_SELECT",
                "opciones": [
                    "Elaborar un Plan de Prevención de Riesgos",
                    "Proporcionar EPP adecuados sin costo para el trabajador",
                    "Investigar accidentes e incidentes laborales",
                    "Informar y formar a los trabajadores sobre los riesgos",
                ],
                "respuesta_correcta": [0, 1, 2, 3],
                "orden": 3,
            },
            {
                "texto": "La fórmula para evaluar el nivel de riesgo laboral es: Riesgo = Probabilidad × Severidad.",
                "tipo": "TRUE_FALSE",
                "opciones": ["Verdadero", "Falso"],
                "respuesta_correcta": True,
                "orden": 4,
            },
            {
                "texto": "¿Qué significa el acrónimo IPER en seguridad y salud laboral?",
                "tipo": "MULTIPLE_CHOICE",
                "opciones": [
                    "Inspección Periódica de Equipos y Riesgos",
                    "Identificación de Peligros y Evaluación de Riesgos",
                    "Índice de Prevención de Emergencias y Respuesta",
                    "Informe de Procedimientos de Evacuación y Rescate",
                ],
                "respuesta_correcta": 1,
                "orden": 5,
            },
            {
                "texto": "El EPP (Equipo de Protección Personal) es el primer nivel de control que debe aplicarse.",
                "tipo": "TRUE_FALSE",
                "opciones": ["Verdadero", "Falso"],
                "respuesta_correcta": False,
                "orden": 6,
            },
        ]

        for q_data in questions:
            Question.objects.get_or_create(
                assessment=assessment,
                texto=q_data["texto"],
                defaults={
                    "tipo": q_data["tipo"],
                    "opciones": q_data["opciones"],
                    "respuesta_correcta": q_data["respuesta_correcta"],
                    "orden": q_data["orden"],
                    "aprobada_por_humano": True,
                },
            )
        self.stdout.write(f"    + {len(questions)} preguntas para {assessment.course.titulo}")

    # -----------------------------------------------------------------------
    # Enrollments + Progress + UserAnswers + Certificates
    # -----------------------------------------------------------------------

    def _create_enrollments(self, users, courses):
        """
        Enrollment matrix:
        Ana:    ISO (completado 100% + cert), Prevención (en_progreso 67%)
        Pedro:  ISO (en_progreso 75%), Excel (completado 100% + cert)
        María:  Inducción (completado 100%), ISO (en_progreso 25%)
        José:   Prevención (completado 100% + cert), Excel (en_progreso 67%)
        Laura:  Inducción (completado 100%), Excel (en_progreso 33%)
        Admin:  ISO (completado 100% + cert)
        """
        from apps.assessments.models import Assessment
        from apps.courses.models import Certificate, Enrollment, Module, ModuleProgress
        from apps.users.models import User

        admin = User.objects.filter(email="admin@empresa.com").first()
        ana = users["ana.garcia@empresa.com"]
        pedro = users["pedro.lopez@empresa.com"]
        maria = users["maria.rodriguez@empresa.com"]
        jose = users["jose.martinez@empresa.com"]
        laura = users["laura.sanchez@empresa.com"]

        matrix = [
            # (user, course_key, estado, modulos_completados, nota_examen)
            (admin,  "iso27001",   "COMPLETADO",  4, Decimal("87.50")),
            (ana,    "iso27001",   "COMPLETADO",  4, Decimal("100.0")),
            (ana,    "prevencion", "EN_PROGRESO",  2, None),
            (pedro,  "iso27001",   "EN_PROGRESO",  3, None),
            (pedro,  "excel",      "COMPLETADO",  3, None),
            (maria,  "induccion",  "COMPLETADO",  3, None),
            (maria,  "iso27001",   "EN_PROGRESO",  1, None),
            (jose,   "prevencion", "COMPLETADO",  3, Decimal("83.33")),
            (jose,   "excel",      "EN_PROGRESO",  2, None),
            (laura,  "induccion",  "COMPLETADO",  3, None),
            (laura,  "excel",      "EN_PROGRESO",  1, None),
        ]

        now = timezone.now()

        for user, course_key, estado, modulos_ok, nota in matrix:
            course = courses[course_key]
            modules = list(course.modules.order_by("orden"))
            total_modules = len(modules)
            pct = int((modulos_ok / total_modules) * 100) if total_modules else 0

            enrollment, created = Enrollment.objects.get_or_create(
                user=user,
                course=course,
                defaults={
                    "estado": estado,
                    "progreso_porcentaje": pct,
                    "fecha_completado": (now - timedelta(days=7)) if estado == "COMPLETADO" else None,
                },
            )
            if not created:
                enrollment.estado = estado
                enrollment.progreso_porcentaje = pct
                enrollment.fecha_completado = (now - timedelta(days=7)) if estado == "COMPLETADO" else None
                enrollment.save(update_fields=["estado", "progreso_porcentaje", "fecha_completado"])

            # ModuleProgress
            for i, module in enumerate(modules):
                is_done = i < modulos_ok
                mp, _ = ModuleProgress.objects.get_or_create(
                    enrollment=enrollment,
                    module=module,
                    defaults={
                        "is_completed": is_done,
                        "fecha_completado": (now - timedelta(days=8 + i)) if is_done else None,
                    },
                )
                if not _:
                    mp.is_completed = is_done
                    mp.fecha_completado = (now - timedelta(days=8 + i)) if is_done else None
                    mp.save(update_fields=["is_completed", "fecha_completado"])

            # UserAnswer (exam) for completed with nota
            if nota is not None and estado == "COMPLETADO":
                try:
                    assessment = Assessment.objects.get(course=course)
                    self._create_user_answer(enrollment, assessment, nota, now)
                except Assessment.DoesNotExist:
                    pass

                # Certificate
                if not hasattr(enrollment, "certificate") or enrollment.certificate is None:
                    Certificate.objects.get_or_create(
                        enrollment=enrollment,
                        defaults={
                            "user": user,
                            "course": course,
                            "nota_obtenida": nota,
                        },
                    )
                elif nota:
                    # Certificate exists, completado sin examen (Inducción, Excel)
                    pass

            # Certificate for completado without exam (Inducción, Excel sin assessment)
            if estado == "COMPLETADO" and nota is None:
                Certificate.objects.get_or_create(
                    enrollment=enrollment,
                    defaults={
                        "user": user,
                        "course": course,
                        "nota_obtenida": None,
                    },
                )

            mark = "+" if created else "·"
            self.stdout.write(
                f"  {mark} Inscripción: {user.first_name} → {course.titulo[:40]} "
                f"[{estado} {pct}%]"
            )

    def _create_user_answer(self, enrollment, assessment, nota, now):
        from apps.assessments.models import UserAnswer

        if UserAnswer.objects.filter(enrollment=enrollment, assessment=assessment).exists():
            return

        questions = list(assessment.questions.order_by("orden"))
        respuestas = {}
        for q in questions:
            # Use the correct answer to achieve the given nota
            respuestas[str(q.id)] = q.respuesta_correcta

        ua = UserAnswer.objects.create(
            enrollment=enrollment,
            assessment=assessment,
            intento_numero=1,
            respuestas_json=respuestas,
            calificacion=nota,
            aprobado=nota >= assessment.puntaje_minimo,
            fecha_fin=now - timedelta(hours=1, minutes=30),
        )
        return ua

    # -----------------------------------------------------------------------
    # Summary
    # -----------------------------------------------------------------------

    def _print_summary(self, users, courses):
        from apps.courses.models import Enrollment

        self.stdout.write("\n" + "=" * 60)
        self.stdout.write("  RESUMEN DE DATOS DE DEMO")
        self.stdout.write("=" * 60)
        self.stdout.write("\nUsuarios creados (contraseña: Demo1234!):")
        for email, user in users.items():
            self.stdout.write(f"  • {user.get_full_name():<22} {email}")

        self.stdout.write("\nCursos:")
        for key, course in courses.items():
            enrollments_count = Enrollment.objects.filter(course=course).count()
            self.stdout.write(
                f"  • [{course.estado:<10}] {course.titulo[:45]:<45} "
                f"({enrollments_count} inscritos)"
            )

        self.stdout.write("\nAcceso al sistema:")
        self.stdout.write("  URL:        http://localhost:3001")
        self.stdout.write("  Admin:      admin@empresa.com   / Admin1234!")
        self.stdout.write("  Instructor: instructor@empresa.com / Demo1234!")
        self.stdout.write("  Usuario:    ana.garcia@empresa.com / Demo1234!")
        self.stdout.write("=" * 60 + "\n")
