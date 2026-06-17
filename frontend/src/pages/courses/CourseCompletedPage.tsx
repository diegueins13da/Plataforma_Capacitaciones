/**
 * P16 — Course Completed
 * Celebration screen shown when all modules are finished.
 */
import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { coursesService } from "../../services/coursesService";

export default function CourseCompletedPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const [courseTitle, setCourseTitle] = useState("");

  useEffect(() => {
    if (!courseId) return;
    coursesService.getCourse(Number(courseId)).then((c) => setCourseTitle(c.titulo));
  }, [courseId]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-green-50 px-4">
      <div className="max-w-md w-full text-center">
        {/* Trophy / checkmark */}
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-100 flex items-center justify-center text-4xl">
          🎉
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          ¡Curso completado!
        </h1>
        {courseTitle && (
          <p className="text-gray-600 mb-1 font-medium">{courseTitle}</p>
        )}
        <p className="text-gray-500 text-sm mb-8">
          Has completado todos los módulos del curso. ¡Excelente trabajo!
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to={`/courses/${courseId}`}
            className="px-5 py-2.5 text-sm font-medium border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Ver detalle del curso
          </Link>
          <Link
            to="/courses"
            className="px-5 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Mis cursos
          </Link>
        </div>

        <p className="text-xs text-gray-400 mt-8">
          Si el curso tiene evaluación, el administrador te notificará cuando esté disponible.
        </p>
      </div>
    </div>
  );
}
