/**
 * P19 — Exam Passed
 * P20 — Exam Failed (with remaining attempts)
 * P21 — Exam Failed (no attempts left)
 *
 * Single page that conditionally renders one of the three outcomes.
 */
import { useEffect } from "react";
import { useLocation, useNavigate, useParams, Link } from "react-router-dom";
import { toast } from "sonner";

interface ResultState {
  assessmentId: number;
  calificacion: number;
  aprobado: boolean;
  intento_numero: number;
  maxIntentos: number;
  puntajeMinimo: number;
  timeExpired?: boolean;
}

// --- P19: Passed -----------------------------------------------------------

function PassedView({
  courseId,
  calificacion,
  puntajeMinimo,
}: {
  courseId: string;
  calificacion: number;
  puntajeMinimo: number;
}) {
  return (
    <div className="text-center space-y-6">
      <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/15 flex items-center justify-center text-4xl">
        🏆
      </div>
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          ¡Felicidades, aprobaste!
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Has superado la evaluación exitosamente.
        </p>
      </div>

      <div className="flex justify-center gap-6">
        <div className="text-center">
          <p className="text-4xl font-bold text-emerald-400">
            {calificacion.toFixed(0)}%
          </p>
          <p className="text-xs text-muted-foreground mt-1">Tu calificación</p>
        </div>
        <div className="w-px bg-muted" />
        <div className="text-center">
          <p className="text-4xl font-bold text-muted-foreground">
            {puntajeMinimo}%
          </p>
          <p className="text-xs text-muted-foreground mt-1">Nota mínima</p>
        </div>
      </div>

      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3 text-sm text-emerald-400">
        Tu certificado de finalización está siendo generado y estará disponible
        próximamente.
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link
          to={`/courses/${courseId}`}
          className="px-5 py-2.5 text-sm font-medium border border-border rounded-xl text-foreground hover:bg-background transition-colors"
        >
          Ver curso
        </Link>
        <Link
          to="/courses"
          className="px-5 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-all duration-300"
        >
          Mis cursos
        </Link>
      </div>
    </div>
  );
}

// --- P20: Failed (attempts remaining) -------------------------------------

function FailedView({
  courseId,
  calificacion,
  puntajeMinimo,
  remainingAttempts,
  timeExpired,
}: {
  courseId: string;
  calificacion: number;
  puntajeMinimo: number;
  remainingAttempts: number;
  timeExpired: boolean;
}) {
  return (
    <div className="text-center space-y-6">
      <div className="w-20 h-20 mx-auto rounded-full bg-amber-500/15 flex items-center justify-center text-4xl">
        📋
      </div>
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {timeExpired ? "Tiempo agotado" : "No aprobaste esta vez"}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {timeExpired
            ? "El examen se envió automáticamente al agotarse el tiempo."
            : "No alcanzaste la calificación mínima. ¡Puedes volver a intentarlo!"}
        </p>
      </div>

      <div className="flex justify-center gap-6">
        <div className="text-center">
          <p className="text-4xl font-bold text-amber-400">
            {calificacion.toFixed(0)}%
          </p>
          <p className="text-xs text-muted-foreground mt-1">Tu calificación</p>
        </div>
        <div className="w-px bg-muted" />
        <div className="text-center">
          <p className="text-4xl font-bold text-muted-foreground">{puntajeMinimo}%</p>
          <p className="text-xs text-muted-foreground mt-1">Nota mínima</p>
        </div>
      </div>

      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-sm text-amber-400">
        Te quedan{" "}
        <strong>
          {remainingAttempts} intento{remainingAttempts !== 1 ? "s" : ""}
        </strong>{" "}
        para aprobar.
      </div>

      <div>
        <p className="text-sm text-muted-foreground mb-3 font-medium">
          Sugerimos repasar los módulos del curso antes de reintentar:
        </p>
        <Link
          to={`/courses/${courseId}`}
          className="text-sm text-indigo-400 underline hover:text-indigo-300"
        >
          Ver módulos del curso →
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link
          to={`/courses/${courseId}`}
          className="px-5 py-2.5 text-sm font-medium border border-border rounded-xl text-foreground hover:bg-background transition-colors"
        >
          Repasar curso
        </Link>
        <Link
          to={`/courses/${courseId}/exam`}
          className="px-5 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-all duration-300"
        >
          Intentar nuevamente
        </Link>
      </div>
    </div>
  );
}

// --- P21: No more attempts -------------------------------------------------

function NoAttemptsView({
  courseId,
  calificacion,
  puntajeMinimo,
}: {
  courseId: string;
  calificacion: number;
  puntajeMinimo: number;
}) {
  function handleRequestReview() {
    // Stub: T30 will wire this to a real admin notification
    toast.success(
      "Solicitud enviada. Un administrador revisará tu caso pronto.",
      { duration: 5000 }
    );
  }

  return (
    <div className="text-center space-y-6">
      <div className="w-20 h-20 mx-auto rounded-full bg-red-500/15 flex items-center justify-center text-4xl">
        ⛔
      </div>
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Sin intentos disponibles
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Has agotado todos los intentos permitidos para esta evaluación.
        </p>
      </div>

      <div className="flex justify-center gap-6">
        <div className="text-center">
          <p className="text-4xl font-bold text-red-400">
            {calificacion.toFixed(0)}%
          </p>
          <p className="text-xs text-muted-foreground mt-1">Última calificación</p>
        </div>
        <div className="w-px bg-muted" />
        <div className="text-center">
          <p className="text-4xl font-bold text-muted-foreground">{puntajeMinimo}%</p>
          <p className="text-xs text-muted-foreground mt-1">Nota mínima</p>
        </div>
      </div>

      <div className="bg-background border border-border rounded-xl px-4 py-4 text-sm text-muted-foreground space-y-2">
        <p className="font-medium text-foreground">¿Necesitas otra oportunidad?</p>
        <p>
          Puedes solicitar al administrador que restablezca tus intentos.
          Se enviará una notificación para su revisión.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link
          to={`/courses/${courseId}`}
          className="px-5 py-2.5 text-sm font-medium border border-border rounded-xl text-foreground hover:bg-background transition-colors"
        >
          Volver al curso
        </Link>
        <button
          type="button"
          onClick={handleRequestReview}
          className="px-5 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-all duration-300"
        >
          Solicitar revisión manual
        </button>
      </div>

      <p className="text-xs text-muted-foreground">
        También puedes contactar directamente a tu instructor o administrador.
      </p>
    </div>
  );
}

// --- Main component --------------------------------------------------------

export default function ExamResultPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as ResultState | null;

  useEffect(() => {
    if (!state) navigate(`/courses/${courseId}`, { replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!state || !courseId) return null;

  const { calificacion, aprobado, intento_numero, maxIntentos, puntajeMinimo, timeExpired } =
    state;
  const remainingAttempts = Math.max(0, maxIntentos - intento_numero);

  return (
    <div className="max-w-lg mx-auto">
      <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
        {aprobado ? (
          <PassedView
            courseId={courseId}
            calificacion={calificacion}
            puntajeMinimo={puntajeMinimo}
          />
        ) : remainingAttempts > 0 ? (
          <FailedView
            courseId={courseId}
            calificacion={calificacion}
            puntajeMinimo={puntajeMinimo}
            remainingAttempts={remainingAttempts}
            timeExpired={!!timeExpired}
          />
        ) : (
          <NoAttemptsView
            courseId={courseId}
            calificacion={calificacion}
            puntajeMinimo={puntajeMinimo}
          />
        )}
      </div>
    </div>
  );
}
