import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import { useAuthStore } from "../../store/authStore";
import { coursesService, type InstructorDashboardData } from "../../services/coursesService";

// ─── helpers ────────────────────────────────────────────────────────────────
function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function today() {
  return new Date().toLocaleDateString("es-EC", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

const AVATAR_PALETTE = [
  { bg: "rgba(129,140,248,0.18)", color: "#818CF8" },
  { bg: "rgba(52,211,153,0.15)", color: "#34D399" },
  { bg: "rgba(251,191,36,0.15)", color: "#FCD34D" },
  { bg: "rgba(248,113,113,0.15)", color: "#F87171" },
  { bg: "rgba(96,165,250,0.15)", color: "#60A5FA" },
  { bg: "rgba(167,139,250,0.15)", color: "#A78BFA" },
];

function avatarStyle(idx: number) {
  return AVATAR_PALETTE[idx % AVATAR_PALETTE.length];
}

function progressColor(v: number) {
  if (v === 100) return "#34D399";
  if (v >= 50)  return "#818CF8";
  if (v > 0)    return "#FCD34D";
  return "#F87171";
}

const TOOLTIP_STYLE = {
  background: "#1e2a3a",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  color: "#e2e8f0",
  fontSize: 12,
};

// ─── KPI card ───────────────────────────────────────────────────────────────
function KpiCard({
  icon, label, value, sub, accent,
}: { icon: string; label: string; value: string | number; sub?: string; accent: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 flex items-center gap-3" style={{ borderColor: `${accent}33` }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${accent}18` }}>
        <i className={`ti ${icon} text-lg`} style={{ color: accent }} aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground leading-none mb-1">{label}</p>
        <p className="text-2xl font-semibold leading-none" style={{ color: accent }}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1 leading-none">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Alerta banner ───────────────────────────────────────────────────────────
function AlertBanner({ alertas }: { alertas: InstructorDashboardData["alertas"] }) {
  if (alertas.length === 0) return null;
  const a = alertas[0];
  const urgent = a.dias <= 3;
  const color = urgent ? "#EF4444" : "#F59E0B";
  return (
    <div
      className="rounded-xl p-3 flex items-start gap-2.5"
      style={{ background: urgent ? "rgba(239,68,68,0.08)" : "rgba(245,158,11,0.08)", border: `1px solid ${color}30` }}
    >
      <i className="ti ti-clock-exclamation mt-0.5 shrink-0" style={{ color, fontSize: 15 }} aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium" style={{ color }}>
          {alertas.length > 1 ? `${alertas.length} cursos próximos a vencer` : `"${a.curso_titulo}" vence en ${a.dias} día${a.dias !== 1 ? "s" : ""}`}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {alertas.length === 1
            ? `${a.alumnos_afectados} alumno${a.alumnos_afectados !== 1 ? "s" : ""} aún en progreso`
            : alertas.map((al) => `${al.curso_titulo} (${al.dias}d)`).join(" · ")}
        </p>
      </div>
    </div>
  );
}

// ─── Cursos row cards ────────────────────────────────────────────────────────
function CursoCard({ c, idx }: { c: InstructorDashboardData["cursos"][0]; idx: number }) {
  const isPublished = c.estado === "PUBLICADO";
  const completionPct = c.total_inscritos > 0 ? Math.round(c.completados / c.total_inscritos * 100) : 0;
  const urgentDays = c.dias_para_vencer !== null && c.dias_para_vencer <= 7;

  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-foreground leading-tight line-clamp-2">{c.titulo}</p>
        <span
          className="text-xs px-2 py-0.5 rounded-full shrink-0 font-medium"
          style={isPublished
            ? { background: "rgba(52,211,153,0.12)", color: "#34D399" }
            : { background: "rgba(100,116,139,0.15)", color: "#94a3b8" }}
        >
          {isPublished ? "Publicado" : "Borrador"}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-xl font-semibold text-foreground">{c.total_inscritos}</p>
          <p className="text-xs text-muted-foreground">alumnos</p>
        </div>
        <div>
          <p className="text-xl font-semibold" style={{ color: "#34D399" }}>{completionPct}%</p>
          <p className="text-xs text-muted-foreground">completado</p>
        </div>
        <div>
          <p
            className="text-xl font-semibold"
            style={{ color: c.nota_promedio ? (c.nota_promedio >= 70 ? "#34D399" : "#F87171") : "#64748b" }}
          >
            {c.nota_promedio !== null ? `${c.nota_promedio}%` : "—"}
          </p>
          <p className="text-xs text-muted-foreground">nota prom.</p>
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${c.progreso_promedio}%`, background: progressColor(c.progreso_promedio) }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1">{c.progreso_promedio}% progreso promedio</p>
      </div>

      {c.fecha_limite && (
        <p className="text-xs flex items-center gap-1" style={{ color: urgentDays ? "#F87171" : "#94a3b8" }}>
          <i className={`ti ${urgentDays ? "ti-alert-triangle" : "ti-calendar"}`} aria-hidden="true" />
          Vence {new Date(c.fecha_limite).toLocaleDateString("es-EC", { day: "numeric", month: "short" })}
          {c.dias_para_vencer !== null && ` · ${c.dias_para_vencer}d`}
        </p>
      )}
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────
export default function InstructorDashboardPage() {
  const user = useAuthStore((s) => s.user);
  const [data, setData] = useState<InstructorDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    coursesService
      .getInstructorDashboard()
      .then(setData)
      .catch(() => setError("No se pudo cargar el dashboard."))
      .finally(() => setLoading(false));
  }, []);

  const firstName = user?.full_name?.split(" ")[0] ?? "Instructor";

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <div className="w-8 h-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  if (error || !data) {
    return <div className="py-12 text-center"><p className="text-muted-foreground">{error ?? "Sin datos."}</p></div>;
  }

  const { kpis, cursos, alumnos, alertas } = data;

  // Chart data: alumnos inscritos por curso (solo publicados o con inscritos)
  const cursosConInscritos = cursos.filter((c) => c.total_inscritos > 0 || c.estado === "PUBLICADO");
  const barDataCursos = cursosConInscritos.map((c) => ({
    name: c.titulo.length > 20 ? c.titulo.slice(0, 20) + "…" : c.titulo,
    inscritos: c.total_inscritos,
    estado: c.estado,
  }));

  // Donut: estado inscripciones
  const totalEnroll = kpis.total_alumnos;
  const completados = cursos.reduce((s, c) => s + c.completados, 0);
  const enProgreso = cursos.reduce((s, c) => s + c.en_progreso, 0);
  const vencidos = cursos.reduce((s, c) => s + c.vencidos, 0);
  const donutData = [
    { name: "Completado", value: completados, color: "#34D399" },
    { name: "En progreso", value: enProgreso, color: "#818CF8" },
    { name: "Vencido", value: vencidos, color: "#F87171" },
  ].filter((d) => d.value > 0);

  // Bar: progreso individual
  const alumnosBar = [...alumnos]
    .sort((a, b) => a.progreso - b.progreso)
    .slice(0, 10)
    .map((a) => ({
      name: a.nombre.split(" ").slice(0, 2).map((p, i) => i === 1 ? p[0] + "." : p).join(" "),
      progreso: a.progreso,
      estado: a.estado,
    }));

  // Bar: notas por curso
  const notaData = cursos
    .filter((c) => c.nota_promedio !== null)
    .map((c) => ({
      name: c.titulo.length > 18 ? c.titulo.slice(0, 18) + "…" : c.titulo,
      nota: c.nota_promedio!,
      tasa: c.tasa_aprobacion ?? 0,
    }));

  // Alumnos en riesgo: bajo progreso + deadline próximo o sin iniciar
  const enRiesgo = alumnos
    .filter((a) => a.progreso < 50 && a.estado === "EN_PROGRESO")
    .slice(0, 5);

  return (
    <div className="space-y-5">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          {greeting()}, {firstName}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">{cap(today())} · Vista Instructor</p>
      </div>

      {/* Alertas */}
      <AlertBanner alertas={alertas} />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon="ti-users" label="Alumnos activos" value={kpis.total_alumnos} sub={`en ${kpis.cursos_publicados} cursos`} accent="#818CF8" />
        <KpiCard icon="ti-trophy" label="Tasa de completado" value={`${kpis.tasa_completado}%`} sub={`${completados} de ${totalEnroll} alumnos`} accent="#34D399" />
        <KpiCard icon="ti-trending-up" label="Progreso promedio" value={`${kpis.progreso_promedio}%`} sub="avance general" accent="#FCD34D" />
        <KpiCard icon="ti-books" label="Mis cursos" value={kpis.cursos_publicados + kpis.cursos_borrador} sub={`${kpis.cursos_borrador} en borrador`} accent="#60A5FA" />
      </div>

      {/* Tarjetas resumen por curso */}
      {cursos.length > 0 && (
        <div className={`grid gap-3 ${cursos.length === 1 ? "grid-cols-1" : cursos.length === 2 ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"}`}>
          {cursos.map((c, i) => <CursoCard key={c.id} c={c} idx={i} />)}
        </div>
      )}

      {/* Charts row */}
      {(barDataCursos.length > 0 || donutData.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

          {/* Alumnos por curso */}
          <div className="lg:col-span-3 rounded-xl border border-border bg-card p-5">
            <p className="text-sm font-medium text-foreground mb-4">Alumnos inscritos por curso</p>
            <div style={{ height: Math.max(140, barDataCursos.length * 44) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barDataCursos} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }} barSize={18}>
                  <CartesianGrid horizontal={false} stroke="rgba(255,255,255,0.04)" />
                  <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#64748b" }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={120} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [v, "Alumnos"]} />
                  <Bar dataKey="inscritos" radius={[0, 6, 6, 0]} background={{ fill: "rgba(255,255,255,0.03)", radius: 6 }}>
                    {barDataCursos.map((e, i) => (
                      <Cell key={i} fill={e.estado === "PUBLICADO" ? "#818CF8" : "#475569"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Donut estado */}
          <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5 flex flex-col">
            <p className="text-sm font-medium text-foreground mb-4">Estado de inscripciones</p>
            {donutData.length > 0 ? (
              <>
                <div className="relative flex-1" style={{ minHeight: 160 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={donutData} cx="50%" cy="50%" innerRadius={50} outerRadius={70}
                        paddingAngle={3} dataKey="value" strokeWidth={0}>
                        {donutData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, name: string) => [v, name]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl font-bold text-foreground">{totalEnroll}</span>
                    <span className="text-xs text-muted-foreground">total</span>
                  </div>
                </div>
                <div className="flex flex-wrap justify-center gap-3 mt-2">
                  {donutData.map((d) => (
                    <div key={d.name} className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
                      <span className="text-xs text-muted-foreground">{d.name} {d.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm text-muted-foreground">Sin inscripciones aún</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Progreso individual + Riesgo */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Progreso por alumno */}
        {alumnosBar.length > 0 && (
          <div className="lg:col-span-3 rounded-xl border border-border bg-card p-5">
            <p className="text-sm font-medium text-foreground mb-1">Progreso individual</p>
            <div className="flex flex-wrap gap-3 mb-3">
              {[{ color: "#34D399", label: "Completado" }, { color: "#818CF8", label: "≥50%" },
                { color: "#FCD34D", label: "Bajo avance" }, { color: "#F87171", label: "Sin iniciar" }].map((l) => (
                <span key={l.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: l.color }} />
                  {l.label}
                </span>
              ))}
            </div>
            <div style={{ height: Math.max(160, alumnosBar.length * 36) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={alumnosBar} layout="vertical" margin={{ top: 0, right: 36, left: 0, bottom: 0 }} barSize={18}>
                  <CartesianGrid horizontal={false} stroke="rgba(255,255,255,0.04)" />
                  <XAxis type="number" domain={[0, 100]} tickLine={false} axisLine={false}
                    tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(v) => `${v}%`} />
                  <YAxis type="category" dataKey="name" width={90} tickLine={false} axisLine={false}
                    tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`${v}%`, "Progreso"]} />
                  <Bar dataKey="progreso" radius={[0, 6, 6, 0]} background={{ fill: "rgba(255,255,255,0.03)", radius: 6 }}>
                    {alumnosBar.map((e, i) => <Cell key={i} fill={progressColor(e.progreso)} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Columna derecha: Notas + Riesgo */}
        <div className="lg:col-span-2 flex flex-col gap-4">

          {/* Notas promedio */}
          <div className="rounded-xl border border-border bg-card p-5 flex-1">
            <p className="text-sm font-medium text-foreground mb-3">Nota promedio por curso</p>
            {notaData.length > 0 ? (
              <div style={{ height: Math.max(100, notaData.length * 52) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={notaData} layout="vertical" margin={{ top: 0, right: 36, left: 0, bottom: 0 }} barSize={18}>
                    <CartesianGrid horizontal={false} stroke="rgba(255,255,255,0.04)" />
                    <XAxis type="number" domain={[0, 100]} tickLine={false} axisLine={false}
                      tick={{ fontSize: 10, fill: "#64748b" }} tickFormatter={(v) => `${v}%`} />
                    <YAxis type="category" dataKey="name" width={90} tickLine={false} axisLine={false}
                      tick={{ fontSize: 10, fill: "#94a3b8" }} />
                    <Tooltip contentStyle={TOOLTIP_STYLE}
                      formatter={(v: number, name: string) => [
                        `${v}%`, name === "nota" ? "Nota promedio" : "Tasa aprobación"
                      ]} />
                    <Bar dataKey="nota" radius={[0, 6, 6, 0]} background={{ fill: "rgba(255,255,255,0.03)", radius: 6 }}>
                      {notaData.map((e, i) => (
                        <Cell key={i} fill={e.nota >= 70 ? "#34D399" : "#F87171"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 gap-2">
                <i className="ti ti-chart-bar text-3xl text-muted-foreground opacity-20" aria-hidden="true" />
                <p className="text-xs text-muted-foreground text-center leading-relaxed">
                  Disponible cuando los alumnos<br />completen el examen
                </p>
              </div>
            )}
          </div>

          {/* Alumnos en riesgo */}
          {enRiesgo.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-sm font-medium text-foreground mb-3 flex items-center gap-1.5">
                <i className="ti ti-alert-circle text-amber-500 text-base" aria-hidden="true" />
                Necesitan atención
              </p>
              <div className="flex flex-col gap-2">
                {enRiesgo.map((a, i) => {
                  const st = avatarStyle(i);
                  const isUrgent = a.progreso === 0;
                  return (
                    <div key={`${a.user_id}-${a.curso_id}`}
                      className="flex items-center gap-2.5 p-2 rounded-lg"
                      style={{ background: isUrgent ? "rgba(239,68,68,0.06)" : "rgba(245,158,11,0.06)" }}>
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium shrink-0"
                        style={{ background: st.bg, color: st.color }}>
                        {initials(a.nombre)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{a.nombre}</p>
                        <p className="text-xs text-muted-foreground truncate">{a.curso_titulo.length > 24 ? a.curso_titulo.slice(0, 24) + "…" : a.curso_titulo}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-semibold" style={{ color: isUrgent ? "#F87171" : "#FCD34D" }}>{a.progreso}%</p>
                        {a.dias_para_vencer !== null && (
                          <p className="text-xs text-muted-foreground">{a.dias_para_vencer}d</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Empty state */}
      {cursos.length === 0 && (
        <div className="text-center py-16">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center mx-auto mb-4">
            <i className="ti ti-books text-3xl text-indigo-500" aria-hidden="true" />
          </div>
          <p className="text-muted-foreground mb-1">Aún no has creado ningún curso.</p>
          <p className="text-sm text-muted-foreground">Crea tu primer curso para ver las estadísticas aquí.</p>
        </div>
      )}
    </div>
  );
}
