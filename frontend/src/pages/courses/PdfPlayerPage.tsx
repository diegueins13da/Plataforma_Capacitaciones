/**
 * P14 — PDF Slide Player
 *
 * Renders a PPTX-exported PDF as a horizontal slide deck (one page per screen,
 * no vertical scroll) using PDF.js. Each page is painted to a <canvas>, so there
 * is no iframe and the document is never exposed as a downloadable link.
 *
 * Features
 *  - One slide per screen, fit-to-stage (letterboxed, never scrolls)
 *  - Prev / Next buttons, keyboard arrows, and touch swipe
 *  - Native fullscreen (presentation mode)
 *  - Progress indicator ("Diapositiva X de N")
 *  - Lazy rendering: only the current page is rendered; the next is pre-fetched
 *  - Resume position + per-slide progress tracking
 *  - Analytics hook: window event "lms:slide_view" on each advance
 *  - Completion unlocks once the learner reaches the last slide
 *
 * Note on "download blocking": rendering to canvas + disabling the context menu
 * is deterrence, not DRM. Any client that can display a PDF can ultimately read
 * its bytes; true protection requires server-side watermarking / DRM.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import type { Tema } from "../../types/course";

// Point PDF.js at its web worker (bundled by Vite via the ?url import).
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

interface PdfPlayerProps {
  tema: Tema;
  isCompleted: boolean;
  initialPage?: number;
  onComplete: () => void;
  onPositionUpdate: (position: Record<string, number>) => void;
}

// Cap the canvas backing resolution so retina screens don't allocate huge buffers.
const MAX_DPR = 2;
// Breathing room (px) around the slide inside the stage.
const STAGE_PADDING = 24;

export function PdfPlayerPage({
  tema,
  isCompleted,
  initialPage = 1,
  onComplete,
  onPositionUpdate,
}: PdfPlayerProps) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(Math.max(1, initialPage));
  const [maxReached, setMaxReached] = useState(Math.max(1, initialPage));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [completed, setCompleted] = useState(isCompleted);

  const stageRef = useRef<HTMLDivElement>(null);
  const slideWrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);
  const renderFnRef = useRef<(p: number) => void>(() => {});
  const pageRef = useRef(page);
  const dirRef = useRef<1 | -1>(1);
  const posCbRef = useRef(onPositionUpdate);
  posCbRef.current = onPositionUpdate;

  // ── Load the document once ──────────────────────────────────────────────
  useEffect(() => {
    if (!tema.archivo_pdf) {
      setError(true);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const task = pdfjsLib.getDocument({
      url: tema.archivo_pdf,
      isEvalSupported: false, // security: never eval() font/CMap programs
    });
    task.promise
      .then((doc) => {
        if (cancelled) return;
        setPdf(doc);
        setNumPages(doc.numPages);
        const start = Math.min(Math.max(1, initialPage), doc.numPages);
        setPage(start);
        pageRef.current = start;
        setMaxReached(start);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
      void task.destroy();
    };
    // initialPage is only meaningful on first load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tema.archivo_pdf]);

  // ── Render a single page to the canvas, fit to the stage ────────────────
  const renderPage = useCallback(
    async (pageNum: number) => {
      const pdfDoc = pdf;
      const canvas = canvasRef.current;
      const stage = stageRef.current;
      if (!pdfDoc || !canvas || !stage) return;

      // Cancel an in-flight render before starting a new one.
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          /* no-op */
        }
        renderTaskRef.current = null;
      }

      setRendering(true);
      try {
        const pg = await pdfDoc.getPage(pageNum);
        const availW = Math.max(1, stage.clientWidth - STAGE_PADDING);
        const availH = Math.max(1, stage.clientHeight - STAGE_PADDING);
        const base = pg.getViewport({ scale: 1 });
        // Fit entirely inside the stage — the smaller ratio wins (letterboxing).
        const fit = Math.min(availW / base.width, availH / base.height);
        const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
        const viewport = pg.getViewport({ scale: fit * dpr });

        const ctx = canvas.getContext("2d", { alpha: false });
        if (!ctx) return;

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        // CSS size in logical px keeps it crisp without overflowing the stage.
        canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
        canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;

        const task = pg.render({ canvasContext: ctx, viewport });
        renderTaskRef.current = task;
        await task.promise;
        renderTaskRef.current = null;

        // Play the horizontal slide-in on the freshly painted slide.
        const wrap = slideWrapRef.current;
        if (wrap) {
          const cls = dirRef.current === 1 ? "pdf-slide-in-right" : "pdf-slide-in-left";
          wrap.classList.remove("pdf-slide-in-right", "pdf-slide-in-left");
          void wrap.offsetWidth; // force reflow so the animation re-triggers
          wrap.classList.add(cls);
        }

        // Lazy pre-fetch the next page so the following advance feels instant.
        if (pageNum < pdfDoc.numPages) {
          void pdfDoc.getPage(pageNum + 1).catch(() => undefined);
        }
      } catch {
        // RenderingCancelledException is expected when navigating quickly.
      } finally {
        setRendering(false);
      }
    },
    [pdf]
  );
  renderFnRef.current = renderPage;

  // Render whenever the page, document, or stage size (fullscreen) changes.
  useLayoutEffect(() => {
    void renderPage(page);
  }, [renderPage, page, fullscreen]);

  // Re-fit on container resize (stable observer, calls the latest render fn).
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const ro = new ResizeObserver(() => renderFnRef.current(pageRef.current));
    ro.observe(stage);
    return () => ro.disconnect();
  }, []);

  // Persist the slide on unmount (best-effort resume position).
  useEffect(() => {
    return () => posCbRef.current({ page: pageRef.current });
  }, []);

  // ── Navigation ──────────────────────────────────────────────────────────
  const go = useCallback(
    (target: number, direction: 1 | -1) => {
      const total = numPages || 1;
      const next = Math.min(Math.max(1, target), total);
      if (next === pageRef.current) return;
      pageRef.current = next;
      dirRef.current = direction;
      setPage(next);
      setMaxReached((m) => Math.max(m, next));
      onPositionUpdate({ page: next });
      // Analytics hook — consumers can listen on window for slide telemetry.
      window.dispatchEvent(
        new CustomEvent("lms:slide_view", {
          detail: { temaId: tema.id, page: next, total },
        })
      );
    },
    [numPages, onPositionUpdate, tema.id]
  );

  const goNext = useCallback(() => go(pageRef.current + 1, 1), [go]);
  const goPrev = useCallback(() => go(pageRef.current - 1, -1), [go]);

  // Keyboard navigation (← / →, PageUp / PageDown).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        goPrev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev]);

  // Touch swipe (mobile).
  const touchStartX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
    if (Math.abs(dx) > 50) (dx < 0 ? goNext : goPrev)();
    touchStartX.current = null;
  };

  // ── Fullscreen ──────────────────────────────────────────────────────────
  const toggleFullscreen = useCallback(() => {
    const el = stageRef.current;
    if (!el) return;
    // Both APIs return promises that reject when the browser denies the request
    // (e.g. no user gesture, embedded context, permissions policy) — swallow it.
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
    } else {
      void el.requestFullscreen?.().catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  function handleComplete() {
    setCompleted(true);
    onComplete();
  }

  const reachedEnd = numPages > 0 && maxReached >= numPages;
  const atFirst = page <= 1;
  const atLast = numPages > 0 && page >= numPages;

  return (
    <div className="space-y-4">
      {/* ── Stage ── */}
      <div
        ref={stageRef}
        onContextMenu={(e) => e.preventDefault()}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className="relative select-none bg-background rounded-xl border border-border overflow-hidden"
        style={{ height: fullscreen ? "100vh" : "72vh" }}
      >
        {/* Loading */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
            No se pudo cargar el documento.
          </div>
        )}

        {/* Slide canvas (centered, letterboxed) */}
        {!error && (
          <div className="absolute inset-0 flex items-center justify-center p-3">
            <div ref={slideWrapRef} className="flex items-center justify-center">
              <canvas
                ref={canvasRef}
                className="rounded-md shadow-2xl shadow-black/40 max-w-full max-h-full"
                aria-label={`Diapositiva ${page} de ${numPages}`}
              />
            </div>
          </div>
        )}

        {/* Prev / Next */}
        {!loading && !error && numPages > 1 && (
          <>
            <button
              type="button"
              onClick={goPrev}
              disabled={atFirst}
              aria-label="Diapositiva anterior"
              className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/40 text-white backdrop-blur-sm flex items-center justify-center hover:bg-black/60 disabled:opacity-0 transition-all"
            >
              <i className="ti ti-chevron-left text-xl" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={goNext}
              disabled={atLast}
              aria-label="Diapositiva siguiente"
              className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/40 text-white backdrop-blur-sm flex items-center justify-center hover:bg-black/60 disabled:opacity-0 transition-all"
            >
              <i className="ti ti-chevron-right text-xl" aria-hidden="true" />
            </button>
          </>
        )}

        {/* Fullscreen toggle */}
        {!error && (
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={fullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
            className="absolute top-3 right-3 w-9 h-9 rounded-lg bg-black/40 text-white backdrop-blur-sm flex items-center justify-center hover:bg-black/60 transition-colors"
          >
            <i
              className={`ti ${fullscreen ? "ti-arrows-minimize" : "ti-arrows-maximize"} text-base`}
              aria-hidden="true"
            />
          </button>
        )}

        {/* Progress indicator */}
        {!loading && !error && numPages > 0 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/45 text-white text-xs font-medium backdrop-blur-sm">
            {rendering && (
              <span className="w-3 h-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            )}
            Diapositiva {page} de {numPages}
          </div>
        )}
      </div>

      {/* ── Completion control (hidden in fullscreen) ── */}
      {!fullscreen && (
        <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between gap-4">
          {completed ? (
            <p className="text-sm text-emerald-400 font-medium">✓ Módulo completado</p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {reachedEnd
                  ? "Has revisado todas las diapositivas. Marca el módulo como completado."
                  : "Avanza hasta la última diapositiva para completar el módulo."}
              </p>
              <button
                onClick={handleComplete}
                disabled={!reachedEnd}
                className="shrink-0 px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Marcar como completado
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
