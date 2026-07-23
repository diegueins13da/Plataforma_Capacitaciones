import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { usersService } from "../../services/usersService";
import { coursesService } from "../../services/coursesService";
import { Tooltip } from "../../components/ui/Tooltip";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  trainerCount: number;
  adminCount: number;
  totalGroups: number;
  publishedCourses: number;
  totalCourses: number;
  coursesByStatus: { name: string; value: number; color: string }[];
  roleDistribution: { name: string; value: number }[];
}

// ─────────────────────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────────────────────
function AdminDashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <div className="h-6 w-56 skeleton rounded-lg" />
        <div className="h-4 w-48 skeleton rounded" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl skeleton flex-shrink-0" />
            <div className="space-y-2">
              <div className="h-3 w-20 skeleton rounded" />
              <div className="h-6 w-12 skeleton rounded-lg" />
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-5 h-72 skeleton" />
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4 h-[72px] skeleton" />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// KPI card
// ─────────────────────────────────────────────────────────────
function KpiCard({
  label, value, icon, iconColor, tooltip,
}: {
  label: string;
  value: number | string;
  icon: string;
  iconColor: string;
  tooltip: string;
}) {
  return (
    <Tooltip label={tooltip} side="bottom">
      <div className="w-full bg-card rounded-xl border border-border px-4 py-4 flex items-center gap-4 card-elevated transition-all hover:-translate-y-px cursor-default">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
          style={{
            background: `${iconColor}18`,
            boxShadow: `0 4px 14px ${iconColor}40, inset 0 1px 0 ${iconColor}25`,
          }}
        >
          <i className={`ti ${icon} text-[19px]`} style={{ color: iconColor }} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground mb-1 font-semibold uppercase tracking-wide">
            {label}
          </p>
          <p className="text-2xl font-bold text-foreground leading-none tabular-nums">{value}</p>
        </div>
      </div>
    </Tooltip>
  );
}

// ─────────────────────────────────────────────────────────────
// Role distribution donut
// ─────────────────────────────────────────────────────────────
const ROLE_COLORS = ["#4F46E5", "#10B981", "#64748b"];

function RoleDonut({ data }: { data: { name: string; value: number }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;
  return (
    <div className="rounded-xl border border-border bg-card p-5 h-full flex flex-col card-elevated">
      <SectionLabel icon="ti-chart-pie">Distribución de roles</SectionLabel>
      <div className="flex-1 flex flex-col items-center gap-4">
        <div className="relative w-full" style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={56}
                outerRadius={82}
                paddingAngle={3}
                dataKey="value"
                strokeWidth={0}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={ROLE_COLORS[i]} />
                ))}
              </Pie>
              <RechartsTooltip
                formatter={(v: number, name: string) => [`${v} usuarios`, name]}
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 10,
                  color: "hsl(var(--foreground))",
                  fontSize: 12,
                  boxShadow: "0 8px 24px rgb(0 0 0 / 0.2)",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-2xl font-bold text-foreground tabular-nums">{total}</span>
            <span className="text-xs text-muted-foreground">usuarios</span>
          </div>
        </div>
        <div className="w-full grid grid-cols-3 gap-2 pb-1">
          {data.map((d, i) => (
            <Tooltip key={d.name} label={`${d.value} ${d.name.toLowerCase()}${d.value !== 1 && d.name !== "Capacitador" ? "s" : d.value !== 1 ? "es" : ""}`} side="top">
              <div className="flex flex-col items-center gap-1 cursor-default w-full">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{
                    background: ROLE_COLORS[i],
                    boxShadow: `0 0 6px ${ROLE_COLORS[i]}80`,
                  }}
                />
                <span className="text-xs text-muted-foreground text-center leading-tight">{d.name}</span>
                <span className="text-sm font-bold text-foreground tabular-nums">{d.value}</span>
              </div>
            </Tooltip>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Course status bar chart
// ─────────────────────────────────────────────────────────────
function CourseStatusChart({ data }: { data: { name: string; value: number; color: string }[] }) {
  if (data.every((d) => d.value === 0)) return null;
  return (
    <div className="rounded-xl border border-border bg-card p-5 h-full flex flex-col card-elevated">
      <SectionLabel icon="ti-chart-bar">Cursos por estado</SectionLabel>
      <div className="flex-1" style={{ minHeight: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 8, right: 16, left: -10, bottom: 0 }}
            barSize={40}
          >
            <defs>
              {data.map((entry, i) => (
                <linearGradient key={i} id={`bar-grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={entry.color} stopOpacity={1} />
                  <stop offset="100%" stopColor={entry.color} stopOpacity={0.7} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid
              vertical={false}
              stroke="hsl(var(--border))"
              strokeDasharray="3 3"
              strokeOpacity={0.5}
            />
            <XAxis
              dataKey="name"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))", fontWeight: 500 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            />
            <RechartsTooltip
              cursor={{ fill: "hsl(var(--accent))", radius: 6 }}
              formatter={(v: number, _: unknown, props: { payload?: { name?: string; color?: string } }) => [
                <span style={{ color: props.payload?.color, fontWeight: 700 }}>{v}</span>,
                "Cursos",
              ]}
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 10,
                color: "hsl(var(--foreground))",
                fontSize: 12,
                boxShadow: "0 8px 24px rgb(0 0 0 / 0.2)",
              }}
            />
            <Bar dataKey="value" radius={[8, 8, 0, 0]}>
              {data.map((_, i) => (
                <Cell key={i} fill={`url(#bar-grad-${i})`} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Quick access card
// ─────────────────────────────────────────────────────────────
function QuickCard({
  to, icon, title, desc, color, tooltip,
}: {
  to: string;
  icon: string;
  title: string;
  desc: string;
  color: string;
  tooltip: string;
}) {
  return (
    <Tooltip label={tooltip} side="top">
      <Link
        to={to}
        className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 hover:border-primary/30 card-elevated transition-all group w-full"
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110"
          style={{
            background: `${color}18`,
            boxShadow: `0 4px 12px ${color}30`,
          }}
        >
          <i className={`ti ${icon} text-[17px]`} style={{ color }} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground leading-snug">{title}</p>
          <p className="text-xs text-muted-foreground leading-tight mt-0.5 truncate">{desc}</p>
        </div>
        <i
          className="ti ti-arrow-narrow-right text-sm text-muted-foreground/30 ml-auto flex-shrink-0 translate-x-0 group-hover:translate-x-1 transition-transform"
          aria-hidden="true"
        />
      </Link>
    </Tooltip>
  );
}

// ─────────────────────────────────────────────────────────────
// Shared
// ─────────────────────────────────────────────────────────────
function SectionLabel({ children, icon }: { children: React.ReactNode; icon?: string }) {
  return (
    <p className="text-[11px] font-semibold text-muted-foreground tracking-widest uppercase mb-4 flex items-center gap-1.5">
      {icon && <i className={`ti ${icon} text-[13px]`} aria-hidden="true" />}
      {children}
    </p>
  );
}

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────
export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [allUsers, active, admins, trainers, groups, borrador, publicado, archivado] =
          await Promise.all([
            usersService.getUsers({ page: 1 }),
            usersService.getUsers({ is_active: true }),
            usersService.getUsers({ role: "ADMIN" }),
            usersService.getUsers({ role: "TRAINER" }),
            usersService.getGroups(),
            coursesService.getCourses({ estado: "BORRADOR" }),
            coursesService.getCourses({ estado: "PUBLICADO" }),
            coursesService.getCourses({ estado: "ARCHIVADO" }),
          ]);

        const usuariosCount = allUsers.count - admins.count - trainers.count;
        setStats({
          totalUsers: allUsers.count,
          activeUsers: active.count,
          trainerCount: trainers.count,
          adminCount: admins.count,
          totalGroups: groups.length,
          publishedCourses: publicado.count,
          totalCourses: borrador.count + publicado.count + archivado.count,
          coursesByStatus: [
            { name: "Borrador", value: borrador.count, color: "#64748b" },
            { name: "Publicado", value: publicado.count, color: "#10B981" },
            { name: "Archivado", value: archivado.count, color: "#F59E0B" },
          ],
          roleDistribution: [
            { name: "Admin", value: admins.count },
            { name: "Capacitador", value: trainers.count },
            { name: "Usuario", value: usuariosCount > 0 ? usuariosCount : 0 },
          ],
        });
      } catch {
        // charts render empty
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  if (loading) return <AdminDashboardSkeleton />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground tracking-tight">
          Panel de Administración
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Resumen general de la plataforma</p>
      </div>

      {stats ? (
        <>
          {/* KPI tiles */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Total usuarios"
              value={stats.totalUsers}
              icon="ti-users"
              iconColor="#4F46E5"
              tooltip="Total de cuentas de usuario registradas en la plataforma"
            />
            <KpiCard
              label="Usuarios activos"
              value={stats.activeUsers}
              icon="ti-pulse"
              iconColor="#10B981"
              tooltip="Usuarios con sesión activa o que iniciaron recientemente"
            />
            <KpiCard
              label="Cursos publicados"
              value={stats.publishedCourses}
              icon="ti-book-2"
              iconColor="#F59E0B"
              tooltip="Cursos visibles y disponibles para los usuarios"
            />
            <KpiCard
              label="Capacitadores"
              value={stats.trainerCount}
              icon="ti-chalkboard"
              iconColor="#8B5CF6"
              tooltip="Usuarios con rol de capacitador o instructor"
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ minHeight: 300 }}>
            <RoleDonut data={stats.roleDistribution} />
            <CourseStatusChart data={stats.coursesByStatus} />
          </div>

          {/* Quick access */}
          <div>
            <SectionLabel icon="ti-bolt">Accesos rápidos</SectionLabel>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <QuickCard
                to="/admin/users"
                icon="ti-user-cog"
                title="Gestión de usuarios"
                desc="Crear, editar y cambiar roles"
                color="#4F46E5"
                tooltip="Administrar cuentas, roles y accesos de usuarios"
              />
              <QuickCard
                to="/admin/courses"
                icon="ti-books"
                title="Gestión de cursos"
                desc="Publicar y administrar cursos"
                color="#10B981"
                tooltip="Crear, editar y publicar cursos de capacitación"
              />
              <QuickCard
                to="/admin/certificates"
                icon="ti-award"
                title="Certificados"
                desc="Ver todos los certificados emitidos"
                color="#F59E0B"
                tooltip="Revisar y gestionar certificados emitidos a los usuarios"
              />
              <QuickCard
                to="/admin/config?tab=parametros"
                icon="ti-adjustments-horizontal"
                title="Parámetros generales"
                desc="SMTP, branding, seguridad"
                color="#8B5CF6"
                tooltip="Configurar correo, apariencia y políticas de seguridad"
              />
              <QuickCard
                to="/admin/config?tab=auditoria"
                icon="ti-report-analytics"
                title="Auditoría"
                desc="Registros de actividad del sistema"
                color="#64748b"
                tooltip="Ver el registro completo de acciones y eventos del sistema"
              />
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
            <i className="ti ti-wifi-off text-2xl text-destructive" aria-hidden="true" />
          </div>
          <p className="text-sm text-muted-foreground">No se pudieron cargar los datos.</p>
        </div>
      )}
    </div>
  );
}
