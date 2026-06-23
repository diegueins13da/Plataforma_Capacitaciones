import api from "./api";

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const reportsService = {
  async downloadUsersProgress(): Promise<void> {
    const res = await api.get<Blob>("/v1/reports/users-progress/", { responseType: "blob" });
    triggerDownload(res.data, "reporte_progreso_usuarios.csv");
  },

  async downloadCoursesSummary(): Promise<void> {
    const res = await api.get<Blob>("/v1/reports/courses-summary/", { responseType: "blob" });
    triggerDownload(res.data, "reporte_resumen_cursos.csv");
  },

  async downloadCertificates(): Promise<void> {
    const res = await api.get<Blob>("/v1/reports/certificates/", { responseType: "blob" });
    triggerDownload(res.data, "reporte_certificados.csv");
  },
};
