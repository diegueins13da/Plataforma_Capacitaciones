import { useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { coursesService } from "../../../services/coursesService";
import { useCourseWizardStore } from "../../../store/courseWizardStore";
import { Step1Info } from "./steps/Step1Info";
import { Step2Modules } from "./steps/Step2Modules";
import { Step3Assessment } from "./steps/Step3Assessment";
import { Step4Publish } from "./steps/Step4Publish";

const STEPS = [
  { label: "Información", shortLabel: "1" },
  { label: "Módulos", shortLabel: "2" },
  { label: "Evaluación", shortLabel: "3" },
  { label: "Publicar", shortLabel: "4" },
];

export default function CourseWizardPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const modeParam = searchParams.get("mode") as "create" | "edit" | null;

  const { step, mode, setCourseId, setMode, setStep, setStep1, setModules, reset } =
    useCourseWizardStore();

  useEffect(() => {
    if (modeParam === "edit" && id) {
      setMode("edit");
      const courseId = parseInt(id);
      setCourseId(courseId);
      coursesService
        .getCourse(courseId)
        .then((course) => {
          setStep1({
            titulo: course.titulo,
            descripcion: course.descripcion,
            tipo: course.tipo,
            area: course.area ?? null,
            fecha_limite: course.fecha_limite ?? "",
            version: course.version,
            imagen_portada: course.imagen_portada,
            duracion_horas: course.duracion_horas ? String(course.duracion_horas) : "",
            cert_expira_meses: course.cert_expira_meses ? String(course.cert_expira_meses) : "",
          });
          setModules(course.modules);
          setStep(1);
        })
        .catch(() => {
          toast.error("No se pudo cargar el curso para editar.");
          navigate("/admin/courses");
        });
    } else if (!modeParam || modeParam === "create") {
      setMode("create");
      reset();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, modeParam]);

  const isEdit = mode === "edit";

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate("/admin/courses")}
          className="text-sm text-indigo-600 hover:underline mb-2 inline-block"
        >
          ← Volver a cursos
        </button>
        <h1 className="text-2xl font-bold text-gray-900">
          {isEdit ? "Editar curso" : "Crear nuevo curso"}
        </h1>
      </div>

      {/* Step indicator */}
      <div className="flex items-center mb-8">
        {STEPS.map((s, idx) => {
          const stepNum = (idx + 1) as 1 | 2 | 3 | 4;
          const isActive = step === stepNum;
          const isDone = step > stepNum;
          return (
            <div key={s.label} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                    isActive
                      ? "bg-indigo-600 text-white"
                      : isDone
                      ? "bg-green-500 text-white"
                      : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {isDone ? "✓" : s.shortLabel}
                </div>
                <span
                  className={`text-xs mt-1 ${
                    isActive ? "text-indigo-600 font-medium" : "text-gray-400"
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {idx < STEPS.length - 1 && (
                <div
                  className={`h-0.5 flex-1 mb-5 ${
                    step > stepNum ? "bg-green-400" : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Step content */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        {step === 1 && (
          <Step1Info onNext={() => setStep(2)} />
        )}
        {step === 2 && (
          <Step2Modules onNext={() => setStep(3)} onBack={() => setStep(1)} />
        )}
        {step === 3 && (
          <Step3Assessment onNext={() => setStep(4)} onBack={() => setStep(2)} />
        )}
        {step === 4 && (
          <Step4Publish onBack={() => setStep(3)} />
        )}
      </div>
    </div>
  );
}
