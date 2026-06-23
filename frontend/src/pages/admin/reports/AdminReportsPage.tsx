import { useState } from "react";
import { toast } from "sonner";
import { reportsService } from "../../../services/reportsService";

interface ReportDef {
  id: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  title: string;
  description: string;
  filename: string;
  action: () => Promise<void>;
}

export default function AdminReportsPage() {
  const [downloading, setDownloading] = useState<string | null>(null);

  async function handleDownload(id: string, action: () => Promise<void>) {
    if (downloading) return;
    setDownloading(id);
    try {
      await action();
      toast.success("Reporte descargado correctamente.");
    } catch {
      toast.error("No se pudo generar el reporte. Intenta nuevamente.");
    } finally {
      setDownloading(null);
    }
  }

  const REPORTS: ReportDef[] = [
    {
      id: "users",
      icon: "ti-users",
      iconBg: "bg-indigo-500/15",
      iconColor: "text-indigo-400",
      title: "Progreso de usuarios",
      description:
        "Todos los usuarios activos con sus cursos inscritos, cursos completados y porcentaje de avance general.",
      filename: "reporte_progreso_usuarios.csv",
      action: () => reportsService.downloadUsersProgress(),
    },
    {
      id: "courses",
      icon: "ti-books",
      iconBg: "bg-emerald-500/15",
      iconColor: "text-emerald-400",
      title: "Resumen de cursos",
      description:
        "Estadísticas por curso: número de inscritos, tasa de finalización y nota promedio de los exámenes.",
      filename: "reporte_resumen_cursos.csv",
      action: () => reportsService.downloadCoursesSummary(),
    },
    {
      id: "certificates",
      icon: "ti-certificate",
      iconBg: "bg-amber-500/15",
      iconColor: "text-amber-400",
      title: "Certificados emitidos",
      description:
        "Registro completo de certificados: usuario, curso, fecha de emisión y calificación obtenida.",
      filename: "reporte_certificados.csv",
      action: () => reportsService.downloadCertificates(),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-foreground">Reportes</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Descarga reportes actualizados en formato CSV para análisis en Excel u otras herramientas.
        </p>
      </div>

      {/* Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((report) => (
          <div
            key={report.id}
            className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4"
          >
            <div className="flex items-start gap-4">
              <div
                className={`w-10 h-10 rounded-xl ${report.iconBg} flex items-center justify-center shrink-0`}
              >
                <i
                  className={`ti ${report.icon} ${report.iconColor} text-xl`}
                  aria-hidden="true"
                />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">{report.title}</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {report.description}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-border">
              <span className="text-xs text-muted-foreground font-mono truncate mr-2">
                {report.filename}
              </span>
              <button
                type="button"
                disabled={downloading !== null}
                onClick={() => void handleDownload(report.id, report.action)}
                className="flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-all duration-300 disabled:opacity-50 shrink-0"
              >
                {downloading === report.id ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Generando…
                  </>
                ) : (
                  <>
                    <i className="ti ti-download text-sm" aria-hidden="true" />
                    Descargar
                  </>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
