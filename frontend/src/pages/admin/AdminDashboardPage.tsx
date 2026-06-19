import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { usersService } from "../../services/usersService";
import { coursesService } from "../../services/coursesService";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  trainerCount: number;
  adminCount: number;
  totalGroups: number;
  coursesByStatus: { name: string; value: number; color: string }[];
  roleDistribution: { name: string; value: number }[];
}

// ---------------------------------------------------------------------------
// KPI card
// ---------------------------------------------------------------------------
function KpiCard({
  label, value, icon, iconColor, accent,
}: {
  label: string; value: number | string; icon: string; iconColor: string; accent: string;
}) {
  return (
    <div className={`rounded-xl p-4 flex items-center gap-4 border ${accent} bg-card`}>
      <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `${iconColor}22` }}>
        <i className={`ti ${icon} text-xl`} style={{ color: iconColor }} aria-hidden="true" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        <p className="text-2xl font-semibold text-foreground leading-none">{value}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Role distribution donut
// ---------------------------------------------------------------------------
const ROLE_COLORS = ["#4F46E5", "#10B981", "#64748b"];

function RoleDonut({ data }: { data: { name: string; value: number }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;
  return (
    <div className="rounded-xl border border-border bg-card p-5 h-full flex flex-col">
      <p className="text-sm font-medium text-foreground mb-4">Distribución de roles</p>
      <div className="flex-1 flex flex-col items-center gap-4">
        <div className="relative w-full" style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={56} outerRadius={80}
                paddingAngle={3} dataKey="value" strokeWidth={0}>
                {data.map((_, i) => <Cell key={i} fill={ROLE_COLORS[i]} />)}
              </Pie>
              <Tooltip
                formatter={(v: number, name: string) => [`${v} usuarios`, name]}
                contentStyle={{
                  background: "#1e2a3a", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8, color: "#e2e8f0", fontSize: 12,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-2xl font-bold text-foreground">{total}</span>
            <span className="text-xs text-muted-foreground">usuarios</span>
          </div>
        </div>
        <div className="w-full grid grid-cols-3 gap-2">
          {data.map((d, i) => (
            <div key={d.name} className="flex flex-col items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ background: ROLE_COLORS[i] }} />
              <span className="text-xs text-muted-foreground text-center leading-tight">{d.name}</span>
              <span className="text-sm font-semibold text-foreground">{d.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Course status bar chart
// ---------------------------------------------------------------------------
function CourseStatusChart({ data }: { data: { name: string; value: number; color: string }[] }) {
  if (data.every(d => d.value === 0)) return null;
  return (
    <div className="rounded-xl border border-border bg-card p-5 h-full flex flex-col">
      <p className="text-sm font-medium text-foreground mb-4">Cursos por estado</p>
      <div className="flex-1" style={{ minHeight: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 16, left: -10, bottom: 0 }} barSize={32}>
            <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="name" tickLine={false} axisLine={false}
              tick={{ fontSize: 12, fill: "#94a3b8" }} />
            <YAxis tickLine={false} axisLine={false} allowDecimals={false}
              tick={{ fontSize: 11, fill: "#64748b" }} />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
              formatter={(v: number) => [v, "Cursos"]}
              contentStyle={{
                background: "#1e2a3a", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8, color: "#e2e8f0", fontSize: 12,
              }}
            />
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quick access card
// ---------------------------------------------------------------------------
function QuickCard({ to, icon, title, desc, color }: {
  to: string; icon: string; title: string; desc: string; color: string;
}) {
  return (
    <Link to={to}
      className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 hover:border-indigo-500/40 transition-colors group">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `${color}20` }}>
        <i className={`ti ${icon} text-lg`} style={{ color }} aria-hidden="true" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground group-hover:text-indigo-400 transition-colors">{title}</p>
        <p className="text-xs text-muted-foreground leading-tight mt-0.5">{desc}</p>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
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
        // silently fail — charts show empty
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  return (
    <div className="px-6 py-7 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Panel de Administración</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Resumen general de la plataforma</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
        </div>
      ) : stats ? (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Total usuarios" value={stats.totalUsers}
              icon="ti-users" iconColor="#4F46E5" accent="border-indigo-500/20" />
            <KpiCard label="Usuarios activos" value={stats.activeUsers}
              icon="ti-user-check" iconColor="#10B981" accent="border-emerald-500/20" />
            <KpiCard label="Capacitadores" value={stats.trainerCount}
              icon="ti-school" iconColor="#F59E0B" accent="border-amber-500/20" />
            <KpiCard label="Grupos" value={stats.totalGroups}
              icon="ti-sitemap" iconColor="#8B5CF6" accent="border-violet-500/20" />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ minHeight: 280 }}>
            <RoleDonut data={stats.roleDistribution} />
            <CourseStatusChart data={stats.coursesByStatus} />
          </div>

          {/* Quick access */}
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-3">Accesos rápidos</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <QuickCard to="/admin/config" icon="ti-users" title="Gestión de usuarios"
                desc="Crear, editar y cambiar roles" color="#4F46E5" />
              <QuickCard to="/admin/courses" icon="ti-book" title="Gestión de cursos"
                desc="Publicar y administrar cursos" color="#10B981" />
              <QuickCard to="/admin/certificates" icon="ti-certificate" title="Certificados"
                desc="Ver todos los certificados emitidos" color="#F59E0B" />
              <QuickCard to="/admin/config?tab=parametros" icon="ti-settings" title="Parámetros generales"
                desc="SMTP, branding, seguridad" color="#8B5CF6" />
              <QuickCard to="/admin/config?tab=auditoria" icon="ti-chart-bar" title="Auditoría"
                desc="Registros de actividad" color="#64748b" />
            </div>
          </div>
        </>
      ) : (
        <p className="text-muted-foreground text-sm">No se pudieron cargar los datos.</p>
      )}
    </div>
  );
}
