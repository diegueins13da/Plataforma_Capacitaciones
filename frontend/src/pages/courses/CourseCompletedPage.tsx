import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { coursesService } from "../../services/coursesService";
import type { Course } from "../../types/course";

export default function CourseCompletedPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const [course, setCourse] = useState<Course | null>(null);

  useEffect(() => {
    if (!courseId) return;
    coursesService.getCourse(Number(courseId)).then(setCourse);
  }, [courseId]);

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-background">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-500/15 flex items-center justify-center text-4xl">
          🎉
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-2">
          ¡Curso completado!
        </h1>
        {course?.titulo && (
          <p className="text-muted-foreground mb-1 font-medium">{course.titulo}</p>
        )}
        <p className="text-muted-foreground text-sm mb-8">
          Has completado todos los módulos del curso. ¡Excelente trabajo!
        </p>

        {course && (
          course.has_assessment ? (
            /* Course has exam — must pass to get certificate */
            <div className="flex flex-col gap-3">
              <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl px-4 py-3 text-sm text-indigo-300 mb-2">
                Este curso incluye una evaluación final. Apruébala para obtener tu certificado.
              </div>
              <Link
                to={`/courses/${courseId}/exam`}
                className="px-5 py-2.5 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-all duration-300"
              >
                Ir a la evaluación →
              </Link>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  to={`/courses/${courseId}`}
                  className="px-5 py-2.5 text-sm font-medium border border-border rounded-lg text-foreground hover:bg-background transition-colors"
                >
                  Ver detalle del curso
                </Link>
                <Link
                  to="/courses"
                  className="px-5 py-2.5 text-sm font-medium border border-border rounded-lg text-foreground hover:bg-background transition-colors"
                >
                  Mis cursos
                </Link>
              </div>
            </div>
          ) : (
            /* Course has no exam — certificate was auto-issued */
            <div className="flex flex-col gap-3">
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3 text-sm text-emerald-400 mb-2">
                Tu certificado de finalización ha sido generado y está disponible en tu perfil.
              </div>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  to="/my-certificates"
                  className="px-5 py-2.5 text-sm font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all duration-300"
                >
                  Ver mi certificado
                </Link>
                <Link
                  to="/courses"
                  className="px-5 py-2.5 text-sm font-medium border border-border rounded-lg text-foreground hover:bg-background transition-colors"
                >
                  Mis cursos
                </Link>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
