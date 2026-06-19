/**
 * P28 — Bulk Import Page
 *
 * 3-step wizard:
 *   1. Upload: user selects an .xlsx file → calls preview API
 *   2. Preview: shows valid/error rows → user confirms
 *   3. Result: shows created/failed counts → links to users list
 */
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { usersService } from "../../../services/usersService";
import type {
  BulkImportCommitResult,
  BulkImportErrorRow,
  BulkImportPreviewResult,
  BulkImportValidRow,
  UserRole,
} from "../../../types/user";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "Administrador",
  TRAINER: "Capacitador",
  USUARIO: "Usuario",
};

type Step = "upload" | "preview" | "result";

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StepIndicator({ step }: { step: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: "upload", label: "1. Subir archivo" },
    { key: "preview", label: "2. Previsualizar" },
    { key: "result", label: "3. Resultado" },
  ];
  const idx = steps.findIndex((s) => s.key === step);

  return (
    <nav aria-label="Pasos de importación" className="flex items-center gap-0 mb-8">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center">
          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
              i === idx
                ? "bg-indigo-600 text-white"
                : i < idx
                ? "bg-indigo-500/20 text-indigo-400"
                : "bg-muted/40 text-muted-foreground"
            }`}
          >
            <span
              className={`w-5 h-5 flex items-center justify-center rounded-full text-xs font-bold ${
                i < idx ? "bg-indigo-600 text-white" : ""
              }`}
            >
              {i < idx ? "✓" : i + 1}
            </span>
            {s.label}
          </div>
          {i < steps.length - 1 && (
            <div className={`h-px w-6 ${i < idx ? "bg-indigo-500/40" : "bg-muted"}`} />
          )}
        </div>
      ))}
    </nav>
  );
}

function ErrorRowsTable({ rows }: { rows: BulkImportErrorRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="mb-6">
      <h3 className="text-sm font-semibold text-red-400 mb-2">
        Filas con errores ({rows.length})
      </h3>
      <div className="overflow-x-auto rounded-lg border border-red-500/30">
        <table className="min-w-full text-sm">
          <thead className="bg-red-500/10">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-red-400">Fila</th>
              <th className="px-3 py-2 text-left font-medium text-red-400">Correo</th>
              <th className="px-3 py-2 text-left font-medium text-red-400">Errores</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-red-500/20">
            {rows.map((r) => (
              <tr key={r.row} className="bg-card">
                <td className="px-3 py-2 text-muted-foreground">{r.row}</td>
                <td className="px-3 py-2 text-foreground">{r.email || "—"}</td>
                <td className="px-3 py-2 text-red-400">
                  <ul className="list-disc list-inside space-y-0.5">
                    {r.errors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ValidRowsTable({ rows }: { rows: BulkImportValidRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="mb-6">
      <h3 className="text-sm font-semibold text-emerald-400 mb-2">
        Filas válidas ({rows.length})
      </h3>
      <div className="overflow-x-auto rounded-lg border border-emerald-500/30">
        <table className="min-w-full text-sm">
          <thead className="bg-emerald-500/10">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-emerald-400">Fila</th>
              <th className="px-3 py-2 text-left font-medium text-emerald-400">Correo</th>
              <th className="px-3 py-2 text-left font-medium text-emerald-400">Nombre</th>
              <th className="px-3 py-2 text-left font-medium text-emerald-400">Rol</th>
              <th className="px-3 py-2 text-left font-medium text-emerald-400">Área</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-emerald-500/10">
            {rows.map((r) => (
              <tr key={r.row} className="bg-card">
                <td className="px-3 py-2 text-muted-foreground">{r.row}</td>
                <td className="px-3 py-2 text-foreground">{r.email}</td>
                <td className="px-3 py-2 text-foreground">
                  {r.first_name} {r.last_name}
                </td>
                <td className="px-3 py-2">
                  <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400">
                    {ROLE_LABELS[r.role]}
                  </span>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{r.area || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function BulkImportPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("upload");
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<BulkImportPreviewResult | null>(null);
  const [result, setResult] = useState<BulkImportCommitResult | null>(null);

  // ---------------------------------------------------------------------------
  // Step 1 — Upload
  // ---------------------------------------------------------------------------

  async function handleFile(file: File) {
    if (!file.name.endsWith(".xlsx")) {
      toast.error("Solo se aceptan archivos .xlsx");
      return;
    }
    setLoading(true);
    try {
      const data = await usersService.bulkImportPreview(file);
      setPreview(data);
      setStep("preview");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { file?: string[] } } })?.response?.data?.file?.[0] ??
        "No se pudo procesar el archivo.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  function onFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    e.target.value = "";
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
  }

  // ---------------------------------------------------------------------------
  // Step 2 — Confirm
  // ---------------------------------------------------------------------------

  async function handleConfirm() {
    if (!preview || preview.valid_count === 0) return;
    setLoading(true);
    try {
      const data = await usersService.bulkImportConfirm(preview.valid_rows);
      setResult(data);
      setStep("result");
      if (data.created > 0) {
        toast.success(`${data.created} usuario${data.created !== 1 ? "s" : ""} creado${data.created !== 1 ? "s" : ""} correctamente.`);
      }
    } catch {
      toast.error("Error al confirmar la importación. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setStep("upload");
    setPreview(null);
    setResult(null);
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Importación masiva de usuarios</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Carga múltiples usuarios desde un archivo Excel (.xlsx).
        </p>
      </div>

      <StepIndicator step={step} />

      {/* ── Step 1: Upload ── */}
      {step === "upload" && (
        <div className="bg-card rounded-xl border border-border p-8">
          <div
            role="button"
            tabIndex={0}
            aria-label="Zona de carga de archivo Excel"
            className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
              dragOver
                ? "border-indigo-500 bg-indigo-500/10"
                : "border-border hover:border-indigo-500/40 hover:bg-background"
            }`}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
          >
            {loading ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
                <p className="text-sm text-muted-foreground">Procesando archivo…</p>
              </div>
            ) : (
              <>
                <div className="text-4xl mb-3">📄</div>
                <p className="text-base font-medium text-foreground">
                  Arrastra tu archivo aquí o{" "}
                  <span className="text-indigo-400 underline">haz clic para seleccionar</span>
                </p>
                <p className="text-sm text-muted-foreground mt-1">Solo archivos .xlsx · Máximo 5 MB</p>
              </>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            className="sr-only"
            aria-hidden="true"
            onChange={onFileInputChange}
          />

          <div className="mt-6 p-4 bg-background rounded-lg border border-border text-sm text-muted-foreground">
            <p className="font-medium mb-2">Formato requerido del archivo:</p>
            <div className="overflow-x-auto">
              <table className="text-xs w-full">
                <thead>
                  <tr className="text-left">
                    {["email *", "nombre *", "apellido *", "rol *", "area", "cargo", "grupo"].map(
                      (h) => (
                        <th
                          key={h}
                          className="px-2 py-1 bg-muted/40 border border-border font-semibold"
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {[
                      "ana@empresa.com",
                      "Ana",
                      "Torres",
                      "Usuario / Capacitador / Administrador",
                      "TI",
                      "Dev",
                      "Grupo Riesgos",
                    ].map((v, i) => (
                      <td key={i} className="px-2 py-1 border border-border text-muted-foreground">
                        {v}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">* Campo obligatorio</p>
          </div>
        </div>
      )}

      {/* ── Step 2: Preview ── */}
      {step === "preview" && preview && (
        <div className="bg-card rounded-xl border border-border p-8">
          <div className="flex items-center gap-6 mb-6 p-4 bg-background rounded-lg">
            <div className="text-center">
              <p className="text-3xl font-bold text-emerald-400">{preview.valid_count}</p>
              <p className="text-xs text-muted-foreground mt-0.5">filas válidas</p>
            </div>
            <div className="h-10 w-px bg-muted" />
            <div className="text-center">
              <p className="text-3xl font-bold text-red-400">{preview.error_count}</p>
              <p className="text-xs text-muted-foreground mt-0.5">filas con errores</p>
            </div>
            {preview.error_count > 0 && (
              <>
                <div className="h-10 w-px bg-muted" />
                <p className="text-sm text-amber-400 bg-amber-500/10 border border-amber-500/30 px-3 py-2 rounded-lg">
                  Las filas con errores serán ignoradas. Solo se crearán las {preview.valid_count} filas válidas.
                </p>
              </>
            )}
          </div>

          <ErrorRowsTable rows={preview.error_rows} />
          <ValidRowsTable rows={preview.valid_rows} />

          <div className="flex items-center gap-3 pt-4 border-t border-border">
            <button
              onClick={() => void handleConfirm()}
              disabled={loading || preview.valid_count === 0}
              className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-all duration-300"
            >
              {loading && (
                <span className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              )}
              Confirmar importación ({preview.valid_count} usuario{preview.valid_count !== 1 ? "s" : ""})
            </button>
            <button
              onClick={handleReset}
              disabled={loading}
              className="px-5 py-2 border border-border text-muted-foreground rounded-lg text-sm hover:bg-background"
            >
              Cancelar y subir otro archivo
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Result ── */}
      {step === "result" && result && (
        <div className="bg-card rounded-xl border border-border p-8 text-center">
          <div className="text-5xl mb-4">{result.created > 0 ? "✅" : "⚠️"}</div>
          <h2 className="text-xl font-bold text-foreground mb-2">Importación completada</h2>

          <div className="flex justify-center gap-8 my-6">
            <div>
              <p className="text-4xl font-bold text-emerald-400">{result.created}</p>
              <p className="text-sm text-muted-foreground">usuario{result.created !== 1 ? "s" : ""} creado{result.created !== 1 ? "s" : ""}</p>
            </div>
            {result.failed > 0 && (
              <>
                <div className="h-12 w-px bg-muted" />
                <div>
                  <p className="text-4xl font-bold text-red-400">{result.failed}</p>
                  <p className="text-sm text-muted-foreground">fallido{result.failed !== 1 ? "s" : ""}</p>
                </div>
              </>
            )}
          </div>

          {result.errors.length > 0 && (
            <div className="text-left mb-6">
              <ErrorRowsTable rows={result.errors} />
            </div>
          )}

          <div className="flex justify-center gap-3 mt-4">
            <button
              onClick={() => navigate("/admin/users")}
              className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-all duration-300"
            >
              Ver usuarios
            </button>
            <button
              onClick={handleReset}
              className="px-5 py-2 border border-border text-muted-foreground rounded-lg text-sm hover:bg-background"
            >
              Nueva importación
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
