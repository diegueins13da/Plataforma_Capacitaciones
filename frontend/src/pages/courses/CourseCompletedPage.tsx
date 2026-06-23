/**
 * P16 — Course Completed
 * Celebration screen shown when all modules are finished.
 */
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { coursesService } from "../../services/coursesService";

export default function CourseCompletedPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const [courseTitle, setCourseTitle] = useState("");

  useEffect(() => {
    if (!courseId) return;
    coursesService.getCourse(Number(courseId)).then((c) => setCourseTitle(c.titulo));
  }, [courseId]);

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-background">
      <div className="max-w-md w-full text-center">
        {/* Trophy / checkmark */}
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-500/15 flex items-center justify-center text-4xl">
          🎉
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-2">
          ¡Curso completado!
        </h1>
        {courseTitle && (
          <p className="text-muted-foreground mb-1 font-medium">{courseTitle}</p>
        )}
        <p className="text-muted-foreground text-sm mb-8">
          Has completado todos los módulos del curso. ¡Excelente trabajo!
        </p>

        <div className="flex flex-col gap-3">
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
      </div>
    </div>
  );
}
