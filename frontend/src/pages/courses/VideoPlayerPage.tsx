/**
 * P13 — Video Player
 * Embeds a YouTube/Vimeo video via iframe.
 * Marks the module complete after 90% of the declared duration has elapsed.
 * Saves resume position (seconds elapsed) every 10 s and on unmount.
 */
import { useEffect, useRef, useState } from "react";
import type { Tema } from "../../types/course";

interface VideoPlayerProps {
  tema: Tema;
  isCompleted: boolean;
  enrollmentId: number;
  initialSecond: number;
  onComplete: () => void;
  onPositionUpdate: (position: Record<string, number>) => void;
}

function buildEmbedUrl(url: string, startSecond: number): string {
  try {
    const u = new URL(url);
    // YouTube short link: youtu.be/<id>
    if (u.hostname === "youtu.be") {
      const id = u.pathname.slice(1);
      return `https://www.youtube.com/embed/${id}?start=${startSecond}&autoplay=0&rel=0`;
    }
    // YouTube standard: youtube.com/watch?v=<id>
    if (u.hostname.includes("youtube.com")) {
      const id = u.searchParams.get("v") ?? "";
      return `https://www.youtube.com/embed/${id}?start=${startSecond}&autoplay=0&rel=0`;
    }
    // Vimeo: vimeo.com/<id>
    if (u.hostname.includes("vimeo.com")) {
      const id = u.pathname.slice(1);
      return `https://player.vimeo.com/video/${id}?t=${startSecond}s`;
    }
  } catch {
    // not a parseable URL — return as-is
  }
  return url;
}

export function VideoPlayerPage({
  tema,
  isCompleted,
  initialSecond,
  onComplete,
  onPositionUpdate,
}: VideoPlayerProps) {
  const totalSeconds = (tema.duracion_minutos ?? 5) * 60;
  const completeThreshold = Math.floor(totalSeconds * 0.9);

  const [elapsed, setElapsed] = useState(initialSecond);
  const [completed, setCompleted] = useState(isCompleted);
  const elapsedRef = useRef(initialSecond);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const posIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Tick elapsed time while tab is visible
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setElapsed((s) => {
        const next = s + 1;
        elapsedRef.current = next;
        return next;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Save position every 10 seconds
  useEffect(() => {
    posIntervalRef.current = setInterval(() => {
      onPositionUpdate({ second: elapsedRef.current });
    }, 10_000);
    return () => {
      if (posIntervalRef.current) clearInterval(posIntervalRef.current);
      onPositionUpdate({ second: elapsedRef.current });
    };
  }, [onPositionUpdate]);

  // Trigger completion at 90% of declared duration
  useEffect(() => {
    if (!completed && elapsed >= completeThreshold) {
      setCompleted(true);
      onComplete();
    }
  }, [elapsed, completed, completeThreshold, onComplete]);

  // Native video (uploaded file) or external embed
  const isNativeVideo = Boolean(tema.archivo_video && !tema.url_video);
  const embedUrl = isNativeVideo ? tema.archivo_video : buildEmbedUrl(tema.url_video, initialSecond);
  const percent = Math.min(100, Math.round((elapsed / totalSeconds) * 100));

  return (
    <div className="space-y-4">
      {/* Video player */}
      <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden">
        {isNativeVideo ? (
          <video
            src={embedUrl}
            className="w-full h-full"
            controls
            title={tema.titulo}
          />
        ) : (
          <iframe
            src={embedUrl}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={tema.titulo}
          />
        )}
      </div>

      {/* Progress and completion */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">Tiempo visualizado</span>
          <span className="text-sm font-medium text-indigo-600">{percent}%</span>
        </div>
        <div className="h-2 bg-muted/40 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-400 rounded-full transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
        {completed ? (
          <p className="text-sm text-emerald-400 font-medium mt-2">
            ✓ Módulo completado
          </p>
        ) : (
          <p className="text-xs text-muted-foreground mt-2">
            El módulo se completará automáticamente al ver el 90% del video
          </p>
        )}
      </div>
    </div>
  );
}
