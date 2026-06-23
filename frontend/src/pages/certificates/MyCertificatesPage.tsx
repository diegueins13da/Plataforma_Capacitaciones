import { useEffect, useState } from "react";
import { toast } from "sonner";
import api from "../../services/api";

interface CertificateItem {
  id: string;
  course_title: string;
  course_duracion_horas: number | null;
  participant_name: string;
  instructor_name: string;
  fecha_emision: string;
  nota_obtenida: string | null;
  has_pdf: boolean;
  download_url: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-EC", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function MyCertificatesPage() {
  const [certs, setCerts] = useState<CertificateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<CertificateItem[]>("/v1/certificates/mine/")
      .then((res) => setCerts(res.data))
      .catch(() => toast.error("No se pudieron cargar los certificados."))
      .finally(() => setLoading(false));
  }, []);

  async function handleDownload(cert: CertificateItem) {
    setDownloading(cert.id);
    try {
      const res = await api.get(`/v1/certificates/${cert.id}/download/`, {
        responseType: "blob",
        validateStatus: (s) => s < 500,
      });

      if (res.status === 202 || res.status === 404) {
        toast.info("El certificado se está generando. Inténtalo en unos segundos.");
        return;
      }

      const blob = new Blob([res.data as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Certificado_${cert.course_title.slice(0, 30)}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("No se pudo descargar el certificado. Inténtalo más tarde.");
    } finally {
      setDownloading(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Mis certificados</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Certificados obtenidos al completar cursos satisfactoriamente.
        </p>
      </div>

      {certs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted/40 flex items-center justify-center mb-4">
            <i className="ti ti-certificate text-3xl text-muted-foreground" aria-hidden="true" />
          </div>
          <p className="text-muted-foreground font-medium">Aún no tienes certificados</p>
          <p className="text-sm text-muted-foreground mt-1">
            Completa un curso para obtener tu primer certificado.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {certs.map((cert) => (
            <div
              key={cert.id}
              className="bg-card border border-border rounded-xl p-5 flex items-start gap-4 hover:border-indigo-500/30 transition-colors"
            >
              {/* Icon */}
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
                <i className="ti ti-certificate text-2xl text-indigo-400" aria-hidden="true" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-foreground truncate">{cert.course_title}</h3>
                <div className="flex flex-wrap items-center gap-3 mt-1">
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <i className="ti ti-user text-xs" aria-hidden="true" />
                    {cert.instructor_name || "Instructor"}
                  </span>
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <i className="ti ti-calendar text-xs" aria-hidden="true" />
                    {formatDate(cert.fecha_emision)}
                  </span>
                  {cert.course_duracion_horas && (
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <i className="ti ti-clock text-xs" aria-hidden="true" />
                      {cert.course_duracion_horas} horas
                    </span>
                  )}
                  {cert.nota_obtenida && (
                    <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30 font-medium">
                      Nota: {cert.nota_obtenida}%
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1 font-mono truncate">
                  ID: {cert.id}
                </p>
              </div>

              {/* Actions */}
              <div className="shrink-0 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleDownload(cert)}
                  disabled={downloading === cert.id}
                  className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {downloading === cert.id ? (
                    <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <i className="ti ti-download text-base" aria-hidden="true" />
                  )}
                  Descargar PDF
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
