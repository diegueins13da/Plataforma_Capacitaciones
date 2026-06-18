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
      <div className="w-20 h-20 mx-auto rounded-full bg-green-100 flex items-center justify-center text-4xl">
        🏆
      </div>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          ¡Felicidades, aprobaste!
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Has superado la evaluación exitosamente.
        </p>
      </div>

      <div className="flex justify-center gap-6">
        <div className="text-center">
          <p className="text-4xl font-bold text-green-600">
            {calificacion.toFixed(0)}%
          </p>
          <p className="text-xs text-gray-500 mt-1">Tu calificación</p>
        </div>
        <div className="w-px bg-gray-200" />
        <div className="text-center">
          <p className="text-4xl font-bold text-gray-300">
            {puntajeMinimo}%
          </p>
          <p className="text-xs text-gray-500 mt-1">Nota mínima</p>
        </div>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700">
        Tu certificado de finalización está siendo generado y estará disponible
        próximamente.
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link
          to={`/courses/${courseId}`}
          className="px-5 py-2.5 text-sm font-medium border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Ver curso
        </Link>
        <Link
          to="/my-courses"
          className="px-5 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
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
      <div className="w-20 h-20 mx-auto rounded-full bg-amber-100 flex items-center justify-center text-4xl">
        📋
      </div>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {timeExpired ? "Tiempo agotado" : "No aprobaste esta vez"}
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          {timeExpired
            ? "El examen se envió automáticamente al agotarse el tiempo."
            : "No alcanzaste la calificación mínima. ¡Puedes volver a intentarlo!"}
        </p>
      </div>

      <div className="flex justify-center gap-6">
        <div className="text-center">
          <p className="text-4xl font-bold text-amber-600">
            {calificacion.toFixed(0)}%
          </p>
          <p className="text-xs text-gray-500 mt-1">Tu calificación</p>
        </div>
        <div className="w-px bg-gray-200" />
        <div className="text-center">
          <p className="text-4xl font-bold text-gray-400">{puntajeMinimo}%</p>
          <p className="text-xs text-gray-500 mt-1">Nota mínima</p>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
        Te quedan{" "}
        <strong>
          {remainingAttempts} intento{remainingAttempts !== 1 ? "s" : ""}
        </strong>{" "}
        para aprobar.
      </div>

      <div>
        <p className="text-sm text-gray-600 mb-3 font-medium">
          Sugerimos repasar los módulos del curso antes de reintentar:
        </p>
        <Link
          to={`/courses/${courseId}`}
          className="text-sm text-indigo-600 underline hover:text-indigo-700"
        >
          Ver módulos del curso →
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link
          to={`/courses/${courseId}`}
          className="px-5 py-2.5 text-sm font-medium border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Repasar curso
        </Link>
        <Link
          to={`/courses/${courseId}/exam`}
          className="px-5 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
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
      <div className="w-20 h-20 mx-auto rounded-full bg-red-100 flex items-center justify-center text-4xl">
        ⛔
      </div>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Sin intentos disponibles
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Has agotado todos los intentos permitidos para esta evaluación.
        </p>
      </div>

      <div className="flex justify-center gap-6">
        <div className="text-center">
          <p className="text-4xl font-bold text-red-500">
            {calificacion.toFixed(0)}%
          </p>
          <p className="text-xs text-gray-500 mt-1">Última calificación</p>
        </div>
        <div className="w-px bg-gray-200" />
        <div className="text-center">
          <p className="text-4xl font-bold text-gray-400">{puntajeMinimo}%</p>
          <p className="text-xs text-gray-500 mt-1">Nota mínima</p>
        </div>
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 text-sm text-gray-600 space-y-2">
        <p className="font-medium text-gray-700">¿Necesitas otra oportunidad?</p>
        <p>
          Puedes solicitar al administrador que restablezca tus intentos.
          Se enviará una notificación para su revisión.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link
          to={`/courses/${courseId}`}
          className="px-5 py-2.5 text-sm font-medium border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Volver al curso
        </Link>
        <button
          type="button"
          onClick={handleRequestReview}
          className="px-5 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
        >
          Solicitar revisión manual
        </button>
      </div>

      <p className="text-xs text-gray-400">
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
    <div className="max-w-lg mx-auto px-4 py-10">
      <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
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
