import { useCallback, useEffect, useState } from "react";
import api from "../../services/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CertEntry {
  id: string;
  participant_name: string;
  user_email: string;
  fecha_emision: string;
  nota_obtenida: string | null;
  has_pdf: boolean;
  download_url: string;
}

interface CourseGroup {
  course_id: number;
  course_title: string;
  instructor_name: string;
  count: number;
  certificates: CertEntry[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-EC", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Certificate row
// ---------------------------------------------------------------------------

function CertRow({ cert }: { cert: CertEntry }) {
  return (
    <tr className="border-b border-border last:border-0 hover:bg-accent/30 transition-colors">
      <td className="py-3 px-4 text-sm text-foreground">{cert.participant_name}</td>
      <td className="py-3 px-4 text-xs text-muted-foreground hidden sm:table-cell">{cert.user_email}</td>
      <td className="py-3 px-4 text-xs text-muted-foreground whitespace-nowrap">{formatDate(cert.fecha_emision)}</td>
      <td className="py-3 px-4 text-sm text-center">
        {cert.nota_obtenida != null ? (
          <span className="font-medium text-emerald-500">{cert.nota_obtenida}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="py-3 px-4 text-center">
        {cert.has_pdf ? (
          <a
            href={cert.download_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition-colors"
          >
            <i className="ti ti-download text-sm" aria-hidden="true" />
            PDF
          </a>
        ) : (
          <span className="text-xs text-muted-foreground">Sin PDF</span>
        )}
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Course group card (collapsible)
// ---------------------------------------------------------------------------

function CourseGroup({ group }: { group: CourseGroup }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header row */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-accent/30 transition-colors text-left"
      >
        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "rgba(79,70,229,0.15)" }}>
          <i className="ti ti-book text-indigo-400 text-base" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{group.course_title}</p>
          {group.instructor_name && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Instructor: {group.instructor_name}
            </p>
          )}
        </div>
        <span className="shrink-0 text-xs font-medium px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 mr-2">
          {group.count} {group.count === 1 ? "certificado" : "certificados"}
        </span>
        <i className={`ti ${expanded ? "ti-chevron-up" : "ti-chevron-down"} text-muted-foreground text-base`}
          aria-hidden="true" />
      </button>

      {/* Table */}
      {expanded && (
        <div className="border-t border-border overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-accent/20">
                <th className="py-2.5 px-4 text-xs font-medium text-muted-foreground text-left">Participante</th>
                <th className="py-2.5 px-4 text-xs font-medium text-muted-foreground text-left hidden sm:table-cell">Correo</th>
                <th className="py-2.5 px-4 text-xs font-medium text-muted-foreground text-left">Fecha</th>
                <th className="py-2.5 px-4 text-xs font-medium text-muted-foreground text-center">Nota</th>
                <th className="py-2.5 px-4 text-xs font-medium text-muted-foreground text-center">Descarga</th>
              </tr>
            </thead>
            <tbody>
              {group.certificates.map((cert) => (
                <CertRow key={cert.id} cert={cert} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminCertificatesPage() {
  const [groups, setGroups] = useState<CourseGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (debouncedSearch) params.search = debouncedSearch;
      const res = await api.get<CourseGroup[]>("/v1/certificates/admin/", { params });
      setGroups(res.data);
    } catch {
      setError("No se pudieron cargar los certificados.");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => { void load(); }, [load]);

  const totalCerts = groups.reduce((s, g) => s + g.count, 0);

  return (
    <div className="px-6 py-7 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Certificados</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {!loading && `${totalCerts} certificado${totalCerts !== 1 ? "s" : ""} en ${groups.length} curso${groups.length !== 1 ? "s" : ""}`}
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-base pointer-events-none"
            aria-hidden="true" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por participante…"
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-xl border border-border bg-card py-16 text-center">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center mx-auto mb-4">
            <i className="ti ti-certificate text-2xl text-indigo-500" aria-hidden="true" />
          </div>
          <p className="text-muted-foreground text-sm">
            {search ? "No se encontraron certificados con ese filtro." : "No hay certificados emitidos aún."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <CourseGroup key={group.course_id} group={group} />
          ))}
        </div>
      )}
    </div>
  );
}
