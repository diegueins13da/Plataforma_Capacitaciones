import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import UserManagementPage from "../users/UserManagementPage";
import SystemConfigPage from "./SystemConfigPage";
import AdminReportsPage from "../reports/AdminReportsPage";

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

type TabKey = "usuarios" | "parametros" | "auditoria";

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "usuarios", label: "Usuarios", icon: "ti-users" },
  { key: "parametros", label: "Parámetros generales", icon: "ti-adjustments" },
  { key: "auditoria", label: "Auditoría", icon: "ti-list-details" },
];

function useTabParam(): [TabKey, (t: TabKey) => void] {
  const location = useLocation();
  const navigate = useNavigate();
  const raw = new URLSearchParams(location.search).get("tab");
  const active: TabKey = (raw === "parametros" || raw === "auditoria") ? raw : "usuarios";
  const setTab = (t: TabKey) => {
    navigate(`/admin/config?tab=${t}`, { replace: true });
  };
  return [active, setTab];
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminConfigPage() {
  const [activeTab, setActiveTab] = useTabParam();
  const [mounted, setMounted] = useState<Record<TabKey, boolean>>({
    usuarios: false, parametros: false, auditoria: false,
  });

  // Mount tab content lazily on first visit so state is preserved when switching
  useEffect(() => {
    setMounted(prev => ({ ...prev, [activeTab]: true }));
  }, [activeTab]);

  return (
    <div className="px-6 py-7 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Configuración</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Administración de usuarios, parámetros del sistema y registros de auditoría
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={[
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
              activeTab === tab.key
                ? "border-indigo-500 text-indigo-500 dark:text-indigo-400"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
            ].join(" ")}
          >
            <i className={`ti ${tab.icon} text-base`} aria-hidden="true" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab panels — keep mounted once visited to preserve internal state */}
      <div className={activeTab === "usuarios" ? "" : "hidden"}>
        {mounted.usuarios && <UserManagementPage />}
      </div>
      <div className={activeTab === "parametros" ? "" : "hidden"}>
        {mounted.parametros && <SystemConfigPage />}
      </div>
      <div className={activeTab === "auditoria" ? "" : "hidden"}>
        {mounted.auditoria && <AdminReportsPage />}
      </div>
    </div>
  );
}
