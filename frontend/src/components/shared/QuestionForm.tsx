/**
 * Inline form for creating or editing a Question.
 * Handles MULTIPLE_CHOICE, MULTIPLE_SELECT, and TRUE_FALSE types.
 */
import { useEffect, useState } from "react";
import type { CreateQuestionPayload, Question, QuestionTipo } from "../../types/assessment";

interface QuestionFormProps {
  initial?: Question;
  defaultOrden?: number;
  onSave: (payload: CreateQuestionPayload) => Promise<void>;
  onCancel: () => void;
}

const TIPO_LABELS: Record<QuestionTipo, string> = {
  MULTIPLE_CHOICE: "Selección única",
  MULTIPLE_SELECT: "Selección múltiple",
  TRUE_FALSE: "Verdadero / Falso",
};

export function QuestionForm({ initial, defaultOrden = 1, onSave, onCancel }: QuestionFormProps) {
  const [tipo, setTipo] = useState<QuestionTipo>(initial?.tipo ?? "MULTIPLE_CHOICE");
  const [texto, setTexto] = useState(initial?.texto ?? "");
  const [opciones, setOpciones] = useState<string[]>(
    initial?.opciones.length ? initial.opciones : ["", "", "", ""]
  );
  const [correctaIdx, setCorrectaIdx] = useState<number>(
    tipo === "MULTIPLE_CHOICE" && typeof initial?.respuesta_correcta === "number"
      ? initial.respuesta_correcta
      : 0
  );
  const [multiSelect, setMultiSelect] = useState<boolean[]>(
    tipo === "MULTIPLE_SELECT" && Array.isArray(initial?.respuesta_correcta)
      ? Array.from({ length: 4 }, (_, i) =>
          (initial!.respuesta_correcta as number[]).includes(i)
        )
      : [false, false, false, false]
  );
  const [trueFalseVal, setTrueFalseVal] = useState<boolean>(
    tipo === "TRUE_FALSE" && typeof initial?.respuesta_correcta === "boolean"
      ? initial.respuesta_correcta
      : true
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (tipo !== "MULTIPLE_CHOICE") setCorrectaIdx(0);
    if (tipo !== "MULTIPLE_SELECT") setMultiSelect([false, false, false, false]);
  }, [tipo]);

  function buildPayload(): CreateQuestionPayload | null {
    if (!texto.trim()) { setError("El enunciado es obligatorio."); return null; }

    if (tipo === "MULTIPLE_CHOICE") {
      const filled = opciones.filter((o) => o.trim());
      if (filled.length < 2) { setError("Ingresa al menos 2 opciones."); return null; }
      return {
        texto: texto.trim(),
        tipo,
        opciones: filled,
        respuesta_correcta: correctaIdx,
        orden: initial?.orden ?? defaultOrden,
      };
    }

    if (tipo === "MULTIPLE_SELECT") {
      const filled = opciones.filter((o) => o.trim());
      if (filled.length < 2) { setError("Ingresa al menos 2 opciones."); return null; }
      const selected = multiSelect.map((v, i) => (v && opciones[i]?.trim() ? i : -1)).filter((i) => i >= 0);
      if (selected.length === 0) { setError("Marca al menos una respuesta correcta."); return null; }
      return {
        texto: texto.trim(),
        tipo,
        opciones: filled,
        respuesta_correcta: selected,
        orden: initial?.orden ?? defaultOrden,
      };
    }

    // TRUE_FALSE
    return {
      texto: texto.trim(),
      tipo,
      opciones: [],
      respuesta_correcta: trueFalseVal,
      orden: initial?.orden ?? defaultOrden,
    };
  }

  async function handleSubmit() {
    setError("");
    const payload = buildPayload();
    if (!payload) return;
    setSaving(true);
    try {
      await onSave(payload);
    } catch {
      setError("Error al guardar la pregunta. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-background border border-border rounded-xl p-4 space-y-4">
      {/* Type selector */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Tipo de pregunta</label>
        <div className="flex gap-2">
          {(Object.keys(TIPO_LABELS) as QuestionTipo[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTipo(t)}
              className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                tipo === t
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "border-border text-muted-foreground hover:bg-muted/40"
              }`}
            >
              {TIPO_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Question text */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Enunciado</label>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={2}
          className="w-full bg-background text-foreground border border-border rounded-lg px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          placeholder="Escribe la pregunta aquí..."
        />
      </div>

      {/* Options — MULTIPLE_CHOICE */}
      {tipo === "MULTIPLE_CHOICE" && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="block text-xs font-medium text-muted-foreground">Opciones</label>
            <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
              <i className="ti ti-star-filled text-[9px] mr-1" />
              marca la respuesta correcta
            </span>
          </div>
          {opciones.map((op, i) => (
            <div
              key={i}
              className={`flex items-center gap-2 rounded-lg px-2 py-1 transition-colors ${
                correctaIdx === i ? "bg-emerald-500/8 ring-1 ring-emerald-500/30" : ""
              }`}
            >
              <button
                type="button"
                title="Marcar como respuesta correcta"
                onClick={() => setCorrectaIdx(i)}
                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                  correctaIdx === i
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : "border-slate-600 hover:border-emerald-500/60"
                }`}
              >
                {correctaIdx === i && <i className="ti ti-check text-[10px]" />}
              </button>
              <input
                type="text"
                value={op}
                onChange={(e) => {
                  const n = [...opciones];
                  n[i] = e.target.value;
                  setOpciones(n);
                }}
                placeholder={`Opción ${i + 1}`}
                className="flex-1 bg-background text-foreground border border-border rounded-lg px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-300"
              />
              {correctaIdx === i && (
                <span className="text-xs text-emerald-400 font-medium shrink-0">Correcta</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Options — MULTIPLE_SELECT */}
      {tipo === "MULTIPLE_SELECT" && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="block text-xs font-medium text-muted-foreground">Opciones</label>
            <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
              <i className="ti ti-star-filled text-[9px] mr-1" />
              marca todas las correctas
            </span>
          </div>
          {opciones.map((op, i) => (
            <div
              key={i}
              className={`flex items-center gap-2 rounded-lg px-2 py-1 transition-colors ${
                multiSelect[i] ? "bg-emerald-500/8 ring-1 ring-emerald-500/30" : ""
              }`}
            >
              <button
                type="button"
                title="Marcar como respuesta correcta"
                onClick={() => {
                  const n = [...multiSelect];
                  n[i] = !n[i];
                  setMultiSelect(n);
                }}
                className={`w-6 h-6 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                  multiSelect[i]
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : "border-slate-600 hover:border-emerald-500/60"
                }`}
              >
                {multiSelect[i] && <i className="ti ti-check text-[10px]" />}
              </button>
              <input
                type="text"
                value={op}
                onChange={(e) => {
                  const n = [...opciones];
                  n[i] = e.target.value;
                  setOpciones(n);
                }}
                placeholder={`Opción ${i + 1}`}
                className="flex-1 bg-background text-foreground border border-border rounded-lg px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-300"
              />
              {multiSelect[i] && (
                <span className="text-xs text-emerald-400 font-medium shrink-0">Correcta</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* TRUE_FALSE */}
      {tipo === "TRUE_FALSE" && (
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Respuesta correcta</label>
          <div className="flex gap-3">
            {[true, false].map((val) => (
              <button
                key={String(val)}
                type="button"
                onClick={() => setTrueFalseVal(val)}
                className={`px-5 py-2 text-sm rounded-lg border transition-colors ${
                  trueFalseVal === val
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "border-border text-muted-foreground hover:bg-background"
                }`}
              >
                {val ? "Verdadero" : "Falso"}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm text-muted-foreground border border-border rounded-lg hover:bg-background"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={saving}
          className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-all duration-300"
        >
          {saving ? "Guardando…" : initial ? "Actualizar" : "Agregar pregunta"}
        </button>
      </div>
    </div>
  );
}
