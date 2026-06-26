/**
 * P15 — Text Player
 * Renders bleach-sanitized HTML. Marks module complete when:
 *   1. The user has scrolled to the bottom of the content, AND
 *   2. At least 30 seconds have elapsed.
 * Saves scroll position every 10 seconds and on unmount.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { Tema } from "../../types/course";

interface TextPlayerProps {
  tema: Tema;
  isCompleted: boolean;
  initialScrollY: number;
  onComplete: () => void;
  onPositionUpdate: (position: Record<string, number>) => void;
}

const MIN_SECONDS = 30;

export function TextPlayerPage({
  tema,
  isCompleted,
  initialScrollY,
  onComplete,
  onPositionUpdate,
}: TextPlayerProps) {
  const [elapsed, setElapsed] = useState(0);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [completed, setCompleted] = useState(isCompleted);
  const contentRef = useRef<HTMLDivElement>(null);
  const elapsedRef = useRef(0);
  const scrollRef = useRef(0);
  const completedRef = useRef(isCompleted);

  // Restore scroll position
  useEffect(() => {
    if (initialScrollY > 0 && contentRef.current) {
      contentRef.current.scrollTop = initialScrollY;
    }
  }, [initialScrollY]);

  // Timer
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

  // Scroll detection
  const handleScroll = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    scrollRef.current = el.scrollTop;
    const atBottom = el.scrollHeight - el.scrollTop <= el.clientHeight + 20;
    if (atBottom) setReachedEnd(true);
  }, []);

  // If content fits without scrolling, mark as reached-end immediately on mount
  useEffect(() => {
    handleScroll();
  }, [handleScroll]);

  // Save position every 10 seconds and on unmount
  useEffect(() => {
    const id = setInterval(() => {
      onPositionUpdate({ scroll: scrollRef.current });
    }, 10_000);
    return () => {
      clearInterval(id);
      onPositionUpdate({ scroll: scrollRef.current });
    };
  }, [onPositionUpdate]);

  // Trigger completion when both conditions are met
  useEffect(() => {
    if (!completedRef.current && reachedEnd && elapsed >= MIN_SECONDS) {
      completedRef.current = true;
      setCompleted(true);
      onComplete();
    }
  }, [elapsed, reachedEnd, onComplete]);

  const timeLeft = Math.max(0, MIN_SECONDS - elapsed);

  return (
    <div className="flex flex-col gap-4">
      {/* Content area */}
      <div
        ref={contentRef}
        onScroll={handleScroll}
        className="bg-card border border-border rounded-xl p-6 overflow-y-auto prose prose-invert prose-sm max-w-none"
        style={{ maxHeight: "65vh" }}
        // Content is sanitized server-side by bleach before storage
        dangerouslySetInnerHTML={{ __html: tema.contenido_html }}
      />

      {/* Progress indicator */}
      <div className="bg-card border border-border rounded-xl p-4">
        {completed ? (
          <p className="text-sm text-emerald-400 font-medium">✓ Módulo completado</p>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span>{reachedEnd ? "✓ Leído hasta el final" : "↓ Desplázate hasta el final"}</span>
              {elapsed < MIN_SECONDS && (
                <span className="text-xs bg-muted/40 px-2 py-0.5 rounded-full">
                  {timeLeft}s restantes
                </span>
              )}
            </div>
            {reachedEnd && elapsed >= MIN_SECONDS && (
              <p className="text-sm text-indigo-600 font-medium">Completando…</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
