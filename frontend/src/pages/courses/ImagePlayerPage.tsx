import { useEffect, useState } from "react";
import type { Tema } from "../../types/course";

interface ImagePlayerProps {
  tema: Tema;
  isCompleted: boolean;
  onComplete: () => void;
}

export function ImagePlayerPage({ tema, isCompleted, onComplete }: ImagePlayerProps) {
  const [completed, setCompleted] = useState(isCompleted);

  // Mark complete after 5 seconds of viewing
  useEffect(() => {
    if (completed) return;
    const timer = setTimeout(() => {
      setCompleted(true);
      onComplete();
    }, 5_000);
    return () => clearTimeout(timer);
  }, [completed, onComplete]);

  const src = tema.archivo_imagen || tema.url_video;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="w-full bg-card border border-border rounded-xl overflow-hidden flex items-center justify-center min-h-[300px]">
        {src ? (
          <img
            src={src}
            alt={tema.titulo}
            className="max-w-full max-h-[70vh] object-contain"
          />
        ) : (
          <p className="text-muted-foreground text-sm">Imagen no disponible.</p>
        )}
      </div>
      <div className="w-full bg-card border border-border rounded-xl p-4">
        {completed ? (
          <p className="text-sm text-emerald-400 font-medium">✓ Módulo completado</p>
        ) : (
          <p className="text-xs text-muted-foreground">Visualiza la imagen para completar este tema.</p>
        )}
      </div>
    </div>
  );
}
