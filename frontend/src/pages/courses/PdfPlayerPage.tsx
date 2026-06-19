/**
 * P14 — PDF Player
 * Renders a PDF in an iframe. A "Marcar como completado" button appears
 * after the user has had the document open for at least 10 seconds (MVP approach;
 * native PDF embeds don't expose page events to JS).
 * Saves resume position (viewed: 1) on first open.
 */
import { useEffect, useRef, useState } from "react";
import type { CourseModuleWithStatus } from "../../types/course";

interface PdfPlayerProps {
  module: CourseModuleWithStatus;
  onComplete: () => void;
  onPositionUpdate: (position: Record<string, number>) => void;
}

const MIN_SECONDS = 10;

export function PdfPlayerPage({ module, onComplete, onPositionUpdate }: PdfPlayerProps) {
  const [elapsed, setElapsed] = useState(0);
  const [completed, setCompleted] = useState(module.is_completed);
  const elapsedRef = useRef(0);
  const posIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const ticker = setInterval(() => {
      setElapsed((s) => {
        const next = s + 1;
        elapsedRef.current = next;
        return next;
      });
    }, 1000);
    return () => clearInterval(ticker);
  }, []);

  // Save position every 10 seconds and on unmount
  useEffect(() => {
    posIntervalRef.current = setInterval(() => {
      onPositionUpdate({ viewed: 1, seconds: elapsedRef.current });
    }, 10_000);
    return () => {
      if (posIntervalRef.current) clearInterval(posIntervalRef.current);
      onPositionUpdate({ viewed: 1, seconds: elapsedRef.current });
    };
  }, [onPositionUpdate]);

  function handleComplete() {
    setCompleted(true);
    onComplete();
  }

  const ready = elapsed >= MIN_SECONDS || module.is_completed;

  return (
    <div className="space-y-4">
      {/* PDF embed */}
      <div className="w-full bg-background rounded-xl overflow-hidden border border-border" style={{ height: "70vh" }}>
        {module.archivo_pdf ? (
          <iframe
            src={module.archivo_pdf}
            className="w-full h-full"
            title={module.titulo}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Archivo PDF no disponible
          </div>
        )}
      </div>

      {/* Completion control */}
      <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between gap-4">
        {completed ? (
          <p className="text-sm text-emerald-400 font-medium">✓ Módulo completado</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {ready
                ? "Cuando termines de revisar el documento, marca el módulo como completado."
                : `Revisa el documento (${MIN_SECONDS - elapsed}s restantes)…`}
            </p>
            <button
              onClick={handleComplete}
              disabled={!ready}
              className="shrink-0 px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Marcar como completado
            </button>
          </>
        )}
      </div>
    </div>
  );
}
