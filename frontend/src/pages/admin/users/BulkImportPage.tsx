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
                ? "bg-indigo-100 text-indigo-700"
                : "bg-gray-100 text-gray-400"
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
            <div className={`h-px w-6 ${i < idx ? "bg-indigo-300" : "bg-gray-200"}`} />
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
      <h3 className="text-sm font-semibold text-red-700 mb-2">
        Filas con errores ({rows.length})
      </h3>
      <div className="overflow-x-auto rounded-lg border border-red-200">
        <table className="min-w-full text-sm">
          <thead className="bg-red-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-red-700">Fila</th>
              <th className="px-3 py-2 text-left font-medium text-red-700">Correo</th>
              <th className="px-3 py-2 text-left font-medium text-red-700">Errores</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-red-100">
            {rows.map((r) => (
              <tr key={r.row} className="bg-white">
                <td className="px-3 py-2 text-gray-500">{r.row}</td>
                <td className="px-3 py-2 text-gray-700">{r.email || "—"}</td>
                <td className="px-3 py-2 text-red-600">
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
      <h3 className="text-sm font-semibold text-green-700 mb-2">
        Filas válidas ({rows.length})
      </h3>
      <div className="overflow-x-auto rounded-lg border border-green-200">
        <table className="min-w-full text-sm">
          <thead className="bg-green-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-green-700">Fila</th>
              <th className="px-3 py-2 text-left font-medium text-green-700">Correo</th>
              <th className="px-3 py-2 text-left font-medium text-green-700">Nombre</th>
              <th className="px-3 py-2 text-left font-medium text-green-700">Rol</th>
              <th className="px-3 py-2 text-left font-medium text-green-700">Área</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-green-50">
            {rows.map((r) => (
              <tr key={r.row} className="bg-white">
                <td className="px-3 py-2 text-gray-400">{r.row}</td>
                <td className="px-3 py-2 text-gray-700">{r.email}</td>
                <td className="px-3 py-2 text-gray-700">
                  {r.first_name} {r.last_name}
                </td>
                <td className="px-3 py-2">
                  <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">
                    {ROLE_LABELS[r.role]}
                  </span>
                </td>
                <td className="px-3 py-2 text-gray-500">{r.area || "—"}</td>
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
        <h1 className="text-2xl font-bold text-gray-900">Importación masiva de usuarios</h1>
        <p className="text-sm text-gray-500 mt-1">
          Carga múltiples usuarios desde un archivo Excel (.xlsx).
        </p>
      </div>

      <StepIndicator step={step} />

      {/* ── Step 1: Upload ── */}
      {step === "upload" && (
        <div className="bg-white rounded-xl border border-gray-200 p-8">
          <div
            role="button"
            tabIndex={0}
            aria-label="Zona de carga de archivo Excel"
            className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
              dragOver
                ? "border-indigo-400 bg-indigo-50"
                : "border-gray-300 hover:border-indigo-300 hover:bg-gray-50"
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
                <p className="text-sm text-gray-500">Procesando archivo…</p>
              </div>
            ) : (
              <>
                <div className="text-4xl mb-3">📄</div>
                <p className="text-base font-medium text-gray-700">
                  Arrastra tu archivo aquí o{" "}
                  <span className="text-indigo-600 underline">haz clic para seleccionar</span>
                </p>
                <p className="text-sm text-gray-400 mt-1">Solo archivos .xlsx · Máximo 5 MB</p>
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

          <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-600">
            <p className="font-medium mb-2">Formato requerido del archivo:</p>
            <div className="overflow-x-auto">
              <table className="text-xs w-full">
                <thead>
                  <tr className="text-left">
                    {["email *", "nombre *", "apellido *", "rol *", "area", "cargo", "grupo"].map(
                      (h) => (
                        <th
                          key={h}
                          className="px-2 py-1 bg-gray-100 border border-gray-200 font-semibold"
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
                      <td key={i} className="px-2 py-1 border border-gray-200 text-gray-500">
                        {v}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-gray-400">* Campo obligatorio</p>
          </div>
        </div>
      )}

      {/* ── Step 2: Preview ── */}
      {step === "preview" && preview && (
        <div className="bg-white rounded-xl border border-gray-200 p-8">
          <div className="flex items-center gap-6 mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="text-center">
              <p className="text-3xl font-bold text-green-600">{preview.valid_count}</p>
              <p className="text-xs text-gray-500 mt-0.5">filas válidas</p>
            </div>
            <div className="h-10 w-px bg-gray-200" />
            <div className="text-center">
              <p className="text-3xl font-bold text-red-500">{preview.error_count}</p>
              <p className="text-xs text-gray-500 mt-0.5">filas con errores</p>
            </div>
            {preview.error_count > 0 && (
              <>
                <div className="h-10 w-px bg-gray-200" />
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
                  Las filas con errores serán ignoradas. Solo se crearán las {preview.valid_count} filas válidas.
                </p>
              </>
            )}
          </div>

          <ErrorRowsTable rows={preview.error_rows} />
          <ValidRowsTable rows={preview.valid_rows} />

          <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
            <button
              onClick={() => void handleConfirm()}
              disabled={loading || preview.valid_count === 0}
              className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading && (
                <span className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              )}
              Confirmar importación ({preview.valid_count} usuario{preview.valid_count !== 1 ? "s" : ""})
            </button>
            <button
              onClick={handleReset}
              disabled={loading}
              className="px-5 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50"
            >
              Cancelar y subir otro archivo
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Result ── */}
      {step === "result" && result && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div className="text-5xl mb-4">{result.created > 0 ? "✅" : "⚠️"}</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Importación completada</h2>

          <div className="flex justify-center gap-8 my-6">
            <div>
              <p className="text-4xl font-bold text-green-600">{result.created}</p>
              <p className="text-sm text-gray-500">usuario{result.created !== 1 ? "s" : ""} creado{result.created !== 1 ? "s" : ""}</p>
            </div>
            {result.failed > 0 && (
              <>
                <div className="h-12 w-px bg-gray-200" />
                <div>
                  <p className="text-4xl font-bold text-red-500">{result.failed}</p>
                  <p className="text-sm text-gray-500">fallido{result.failed !== 1 ? "s" : ""}</p>
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
              className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700"
            >
              Ver usuarios
            </button>
            <button
              onClick={handleReset}
              className="px-5 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50"
            >
              Nueva importación
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
