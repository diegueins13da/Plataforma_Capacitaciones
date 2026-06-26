import { useEffect, useRef, useState } from "react";
import type { Tema } from "../../types/course";

interface IframePlayerProps {
  tema: Tema;
  isCompleted: boolean;
  onComplete: () => void;
  onPositionUpdate: (position: Record<string, number>) => void;
}

export function IframePlayerPage({ tema, isCompleted, onComplete }: IframePlayerProps) {
  const [completed, setCompleted] = useState(isCompleted);
  const [elapsed, setElapsed] = useState(0);
  const elapsedRef = useRef(0);

  const MIN_SECONDS = 30;

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed((s) => {
        const next = s + 1;
        elapsedRef.current = next;
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!completed && elapsed >= MIN_SECONDS) {
      setCompleted(true);
      onComplete();
    }
  }, [elapsed, completed, onComplete]);

  if (!tema.url_iframe) {
    return <p className="text-muted-foreground text-sm p-4">URL de contenido externo no configurada.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="w-full rounded-xl overflow-hidden border border-border bg-black" style={{ height: "70vh" }}>
        <iframe
          src={tema.url_iframe}
          className="w-full h-full"
          title={tema.titulo}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          allowFullScreen
        />
      </div>
      <div className="bg-card border border-border rounded-xl p-4">
        {completed ? (
          <p className="text-sm text-emerald-400 font-medium">✓ Módulo completado</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Interactúa con el contenido. Se completará automáticamente tras {MIN_SECONDS}s.
          </p>
        )}
      </div>
    </div>
  );
}
