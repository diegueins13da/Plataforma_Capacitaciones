import { useCallback, useEffect, useRef, useState } from "react";
import type { Tema } from "../../types/course";

interface IframePlayerProps {
  tema: Tema;
  isCompleted: boolean;
  onComplete: () => void;
  onPositionUpdate: (position: Record<string, number>) => void;
  onAllSlidesVisited?: () => void;
}

interface CoursePage {
  id: string;
  navLabel: string;
}

// Minimum seconds the user must spend on each slide before advancing
const MIN_SLIDE_SECONDS = 20;

// Resolve localhost URLs to the current page's origin so the iframe loads
// correctly regardless of what domain/tunnel the platform is served from.
function resolveIframeUrl(url: string): string {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
      return window.location.origin + parsed.pathname + parsed.search + parsed.hash;
    }
  } catch {
    // Relative URL — leave as-is; browser resolves against current origin
  }
  return url;
}

// CSS injected into the iframe to hide its internal navigation
const HIDE_CSS = `
  .sidebar       { display: none !important; }
  .nav-buttons   { display: none !important; }
  #mobileToggle  { display: none !important; }
  main.content   { padding-left: 0 !important; }
  .app           { min-height: 100vh; }
`;

export function IframePlayerPage({ tema, isCompleted, onAllSlidesVisited }: IframePlayerProps) {
  const iframeRef  = useRef<HTMLIFrameElement>(null);
  const pagesRef   = useRef<CoursePage[]>([]);
  const timerIdRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const notifiedRef = useRef(false); // fire onAllSlidesVisited only once

  const [ready,        setReady]        = useState(false);
  const [blocked,      setBlocked]      = useState(false);
  const [currentIdx,   setCurrentIdx]   = useState(0);
  const [totalPages,   setTotalPages]   = useState(0);
  const [visitedCount, setVisitedCount] = useState(0);
  const [slideSeconds, setSlideSeconds] = useState(0);

  // ── Notify parent when every slide has been visited ───────────────────────
  useEffect(() => {
    if (!notifiedRef.current && totalPages > 0 && visitedCount >= totalPages) {
      notifiedRef.current = true;
      onAllSlidesVisited?.();
    }
  }, [visitedCount, totalPages, onAllSlidesVisited]);

  // ── Per-slide timer ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!ready) return;
    setSlideSeconds(0);

    if (timerIdRef.current) clearInterval(timerIdRef.current);
    timerIdRef.current = setInterval(() => {
      setSlideSeconds((s) => {
        if (s >= MIN_SLIDE_SECONDS) {
          if (timerIdRef.current) clearInterval(timerIdRef.current);
          return s;
        }
        return s + 1;
      });
    }, 1000);

    return () => {
      if (timerIdRef.current) clearInterval(timerIdRef.current);
    };
  }, [currentIdx, ready]);

  // ── After iframe loads ────────────────────────────────────────────────────
  const handleLoad = useCallback(() => {
    const win = iframeRef.current?.contentWindow as (Window & Record<string, unknown>) | null;
    const doc = iframeRef.current?.contentDocument;
    if (!win || !doc || !win["COURSE"]) {
      setBlocked(true);
      return;
    }

    const style = doc.createElement("style");
    style.textContent = HIDE_CSS;
    doc.head.appendChild(style);

    const courseObj = win["COURSE"] as { pages: CoursePage[] };
    const pages = courseObj.pages;
    pagesRef.current = pages;
    setTotalPages(pages.length);

    const activeId = win["activePageId"] as string | undefined;
    const idx      = activeId ? pages.findIndex(p => p.id === activeId) : 0;
    const visited  = win["visited"] as Set<string> | undefined;
    setCurrentIdx(idx >= 0 ? idx : 0);
    setVisitedCount(visited?.size ?? 1);
    setReady(true);

    const origGoTo = win["goTo"] as (id: string) => void;
    win["goTo"] = (id: string) => {
      origGoTo(id);
      const newIdx = pages.findIndex(p => p.id === id);
      setCurrentIdx(newIdx >= 0 ? newIdx : 0);
      const v = win["visited"] as Set<string> | undefined;
      setVisitedCount(v?.size ?? 0);
    };
  }, []);

  // ── Platform navigation ────────────────────────────────────────────────────
  function goToIdx(idx: number) {
    const win   = iframeRef.current?.contentWindow as (Window & Record<string, unknown>) | null;
    const pages = pagesRef.current;
    if (!win || idx < 0 || idx >= pages.length) return;
    (win["goTo"] as (id: string) => void)(pages[idx].id);
  }

  if (!tema.url_iframe) {
    return <p className="text-muted-foreground text-sm p-4">URL de contenido no configurada.</p>;
  }

  const resolvedUrl   = resolveIframeUrl(tema.url_iframe);
  const canPrev       = ready && currentIdx > 0;
  const canNext       = ready && currentIdx < totalPages - 1;
  const isLast        = ready && currentIdx === totalPages - 1;
  const allVisited    = totalPages > 0 && visitedCount >= totalPages;
  const progressPct   = totalPages > 0 ? Math.round((visitedCount / totalPages) * 100) : 0;
  const canAdvance    = slideSeconds >= MIN_SLIDE_SECONDS;
  const countdown     = MIN_SLIDE_SECONDS - slideSeconds;

  return (
    <div className="flex flex-col gap-3">

      {/* Fallback link */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Si el contenido no carga,</span>
        <a
          href={resolvedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-medium underline underline-offset-2"
        >
          ábrelo en nueva pestaña
          <i className="ti ti-external-link text-sm" aria-hidden="true" />
        </a>
      </div>

      {/* Iframe */}
      {blocked ? (
        <div className="w-full rounded-xl border border-border bg-card flex flex-col items-center justify-center gap-4 py-16">
          <i className="ti ti-link-off text-4xl text-muted-foreground/40" aria-hidden="true" />
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">El contenido no puede mostrarse aquí</p>
            <p className="text-xs text-muted-foreground mt-1">El sitio externo bloquea la visualización embebida.</p>
          </div>
          <a
            href={resolvedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Abrir en nueva pestaña
            <i className="ti ti-external-link text-sm" aria-hidden="true" />
          </a>
        </div>
      ) : (
        <div
          className="w-full rounded-xl overflow-hidden border border-border bg-background"
          style={{ height: "68vh" }}
        >
          <iframe
            ref={iframeRef}
            src={resolvedUrl}
            className="w-full h-full"
            title={tema.titulo}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            allowFullScreen
            onLoad={handleLoad}
            onError={() => setBlocked(true)}
          />
        </div>
      )}

      {/* Platform navigation bar */}
      {!blocked && (
        <div className="flex items-center justify-between bg-card border border-border rounded-xl px-5 py-3 gap-4">

          {/* Prev */}
          <button
            type="button"
            onClick={() => goToIdx(currentIdx - 1)}
            disabled={!canPrev}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-sm text-foreground hover:bg-accent/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <i className="ti ti-arrow-left text-base" aria-hidden="true" />
            Anterior
          </button>

          {/* Center — slide counter + progress */}
          <div className="flex flex-col items-center gap-1 flex-1">
            {ready ? (
              <>
                <span className="text-xs text-muted-foreground">
                  Diapositiva{" "}
                  <span className="font-semibold text-foreground">{currentIdx + 1}</span>{" "}
                  de{" "}
                  <span className="font-semibold text-foreground">{totalPages}</span>
                </span>
                <div className="w-full max-w-[200px] h-1.5 bg-border rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground">{progressPct}% visto</span>
              </>
            ) : (
              <div className="w-5 h-5 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
            )}
          </div>

          {/* Right: Next or end-of-course indicator */}
          {isLast && allVisited ? (
            /* All slides done — "Completar módulo" button is now enabled below */
            isCompleted ? (
              <div className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 text-sm font-medium border border-emerald-500/20">
                <i className="ti ti-circle-check text-base" aria-hidden="true" />
                Completado
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 text-sm font-medium border border-emerald-500/20">
                <i className="ti ti-circle-check text-base" aria-hidden="true" />
                Completa el módulo abajo
              </div>
            )
          ) : (
            <button
              type="button"
              onClick={() => goToIdx(currentIdx + 1)}
              disabled={!canNext || !canAdvance}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-w-[136px] justify-center"
            >
              {!canAdvance ? (
                <>
                  <i className="ti ti-clock text-base" aria-hidden="true" />
                  {countdown}s para continuar
                </>
              ) : (
                <>
                  Siguiente
                  <i className="ti ti-arrow-right text-base" aria-hidden="true" />
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
