import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { coursesService } from "../../../../services/coursesService";
import { usersService } from "../../../../services/usersService";
import { useCourseWizardStore } from "../../../../store/courseWizardStore";
import type { Group } from "../../../../types/groups";

interface Props {
  onBack: () => void;
}

export function Step4Publish({ onBack }: Props) {
  const navigate = useNavigate();
  const { courseId, modules, audienciaGrupos, setAudienciaGrupos, setStep, reset } =
    useCourseWizardStore();
  const [groups, setGroups] = useState<Group[]>([]);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    usersService.getGroups().then(setGroups).catch(() => void 0);
  }, []);

  function toggleGroup(id: number) {
    setAudienciaGrupos(
      audienciaGrupos.includes(id)
        ? audienciaGrupos.filter((g) => g !== id)
        : [...audienciaGrupos, id]
    );
  }

  async function saveAudience() {
    if (!courseId) { toast.error("Primero guarda el paso 1."); return; }
    await coursesService.updateCourse(courseId, { audiencia_grupos: audienciaGrupos });
  }

  async function handleSaveDraft() {
    setSaving(true);
    try {
      await saveAudience();
      toast.success("Borrador guardado con la audiencia seleccionada.");
    } catch {
      toast.error("No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (!courseId) { toast.error("No hay un curso activo para publicar."); return; }
    if (modules.length === 0) {
      toast.error("Agrega al menos un módulo antes de publicar."); return;
    }
    setPublishing(true);
    try {
      await saveAudience();
      await coursesService.publishCourse(courseId);
      toast.success("¡Curso publicado! Los usuarios inscritos han sido notificados.");
      reset();
      navigate("/admin/courses");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? "No se pudo publicar el curso.");
    } finally {
      setPublishing(false);
    }
  }

  const hasModules = modules.length > 0;

  return (
    <div className="space-y-5">
      {/* Audience groups */}
      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-2">
          Grupos de audiencia
        </h3>
        <p className="text-xs text-gray-500 mb-3">
          Al publicar, todos los usuarios activos de los grupos seleccionados recibirán
          acceso al curso automáticamente.
        </p>
        {groups.length === 0 ? (
          <p className="text-sm text-gray-400">No hay grupos disponibles.</p>
        ) : (
          <div className="space-y-2">
            {groups.filter((g) => g.activo).map((group) => (
              <label
                key={group.id}
                className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={audienciaGrupos.includes(group.id)}
                  onChange={() => toggleGroup(group.id)}
                  className="w-4 h-4 accent-indigo-600"
                />
                <span className="text-sm font-medium text-gray-800">{group.nombre}</span>
                {group.descripcion && (
                  <span className="text-xs text-gray-400 ml-auto">{group.descripcion}</span>
                )}
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Module count warning */}
      {!hasModules && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
          El curso no tiene módulos. Regresa al paso 2 y agrega al menos uno antes de publicar.
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={() => { setStep(3); onBack(); }}
          className="px-4 py-2 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50"
        >
          ← Anterior
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={saving}
            className="px-4 py-2 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar borrador"}
          </button>
          <button
            type="button"
            onClick={handlePublish}
            disabled={publishing || !hasModules}
            className="px-6 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {publishing ? "Publicando..." : "🚀 Publicar curso"}
          </button>
        </div>
      </div>
    </div>
  );
}
