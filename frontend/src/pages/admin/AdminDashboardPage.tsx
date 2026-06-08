/**
 * P25 — Admin Dashboard Page
 *
 * Landing page for administrators: quick-stat cards + shortcut links.
 * Stats are fetched on mount. Cards for future modules (courses, assessments)
 * show "–" until those APIs exist.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { usersService } from "../../services/usersService";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StatsState {
  totalUsers: number;
  activeUsers: number;
  adminCount: number;
  trainerCount: number;
  totalGroups: number;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface StatCardProps {
  label: string;
  value: number | string;
  color?: string;
}

function StatCard({ label, value, color = "bg-card" }: StatCardProps) {
  return (
    <div className={`rounded-lg border p-5 shadow-sm ${color}`}>
      <p className="text-muted-foreground text-sm font-medium">{label}</p>
      <p className="mt-1 text-3xl font-bold">{value}</p>
    </div>
  );
}

interface ShortcutCardProps {
  title: string;
  description: string;
  to: string;
  icon: string;
}

function ShortcutCard({ title, description, to, icon }: ShortcutCardProps) {
  return (
    <Link
      to={to}
      className="bg-card hover:bg-muted/40 flex items-start gap-4 rounded-lg border p-5 shadow-sm transition-colors"
    >
      <span className="text-2xl">{icon}</span>
      <div>
        <p className="font-semibold">{title}</p>
        <p className="text-muted-foreground mt-0.5 text-sm">{description}</p>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<StatsState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      setLoading(true);
      try {
        // Fetch all users (up to 1 page) to derive counts from meta
        const [usersResp, groups] = await Promise.all([
          usersService.getUsers({ page: 1 }),
          usersService.getGroups(),
        ]);

        // For role counts we need a broader fetch — use role-filtered calls in parallel
        const [admins, trainers, active] = await Promise.all([
          usersService.getUsers({ role: "ADMIN" }),
          usersService.getUsers({ role: "TRAINER" }),
          usersService.getUsers({ is_active: true }),
        ]);

        setStats({
          totalUsers: usersResp.count,
          activeUsers: active.count,
          adminCount: admins.count,
          trainerCount: trainers.count,
          totalGroups: groups.length,
        });
      } catch {
        toast.error("No se pudieron cargar las estadísticas del panel.");
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, []);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Panel de Administración</h1>
        <p className="text-muted-foreground text-sm">
          Resumen general de la plataforma
        </p>
      </div>

      {/* Stats */}
      {loading ? (
        <p className="text-muted-foreground text-sm" role="status">
          Cargando estadísticas...
        </p>
      ) : stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Usuarios totales" value={stats.totalUsers} />
          <StatCard
            label="Usuarios activos"
            value={stats.activeUsers}
            color="bg-green-50"
          />
          <StatCard label="Administradores" value={stats.adminCount} />
          <StatCard label="Capacitadores" value={stats.trainerCount} />
          <StatCard label="Grupos" value={stats.totalGroups} />
          <StatCard label="Cursos activos" value="–" />
          <StatCard label="Evaluaciones pendientes" value="–" />
          <StatCard label="Certificados emitidos" value="–" />
        </div>
      ) : null}

      {/* Shortcuts */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">Accesos rápidos</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ShortcutCard
            icon="👥"
            title="Gestión de usuarios"
            description="Crear, editar y cambiar roles de usuarios."
            to="/admin/users"
          />
          <ShortcutCard
            icon="🗂️"
            title="Grupos"
            description="Organizar usuarios en grupos para asignar cursos."
            to="/admin/groups"
          />
          <ShortcutCard
            icon="📚"
            title="Cursos"
            description="Crear y publicar cursos con módulos y evaluaciones."
            to="/admin/courses"
          />
          <ShortcutCard
            icon="📊"
            title="Reportes"
            description="Ver progreso, completaciones y auditoría."
            to="/admin/reports"
          />
        </div>
      </div>
    </div>
  );
}
