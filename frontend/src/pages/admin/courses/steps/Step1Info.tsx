import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { coursesService } from "../../../../services/coursesService";
import { configService } from "../../../../services/configService";
import { useCourseWizardStore, type Step1Data } from "../../../../store/courseWizardStore";
import type { Area } from "../../../../types/area";

const schema = z.object({
  titulo: z.string().min(3, "El título debe tener al menos 3 caracteres"),
  descripcion: z.string().optional(),
  tipo: z.enum(["ONLINE", "PRESENCIAL", "HIBRIDO", "AUTOAPRENDIZAJE"]),
  area: z.number().nullable().optional(),
  fecha_limite: z.string().optional(),
  version: z.string().min(1, "La versión es requerida"),
  imagen_portada: z.string().optional(),
  duracion_horas: z.string().optional(),
  cert_expira_meses: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  onNext: () => void;
}

const TIPO_LABELS: Record<string, string> = {
  ONLINE: "Online",
  PRESENCIAL: "Presencial",
  HIBRIDO: "Híbrido",
  AUTOAPRENDIZAJE: "Autoaprendizaje",
};

export function Step1Info({ onNext }: Props) {
  const { step1, courseId, setCourseId, setStep1, setStep } = useCourseWizardStore();
  const [areas, setAreas] = useState<Area[]>([]);
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      titulo: step1.titulo,
      descripcion: step1.descripcion,
      tipo: step1.tipo,
      area: step1.area ?? undefined,
      fecha_limite: step1.fecha_limite,
      version: step1.version,
      imagen_portada: step1.imagen_portada,
      duracion_horas: step1.duracion_horas,
      cert_expira_meses: step1.cert_expira_meses,
    },
  });

  useEffect(() => {
    configService.getAreas().then(setAreas).catch(() => void 0);
  }, []);

  async function saveDraft(values: FormValues) {
    setSaving(true);
    try {
      const payload = {
        titulo: values.titulo,
        descripcion: values.descripcion ?? "",
        tipo: values.tipo,
        area: values.area ?? null,
        fecha_limite: values.fecha_limite || null,
        version: values.version,
        imagen_portada: values.imagen_portada ?? "",
        duracion_horas: values.duracion_horas ? parseInt(values.duracion_horas) : null,
        cert_expira_meses: values.cert_expira_meses ? parseInt(values.cert_expira_meses) : null,
      };
      let course;
      if (courseId) {
        course = await coursesService.updateCourse(courseId, payload);
      } else {
        course = await coursesService.createCourse(payload);
        setCourseId(course.id);
      }
      const s1: Partial<Step1Data> = {
        titulo: values.titulo,
        descripcion: values.descripcion ?? "",
        tipo: values.tipo,
        area: values.area ?? null,
        fecha_limite: values.fecha_limite ?? "",
        version: values.version,
        imagen_portada: values.imagen_portada ?? "",
        duracion_horas: values.duracion_horas ?? "",
        cert_expira_meses: values.cert_expira_meses ?? "",
      };
      setStep1(s1);
      return course;
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveDraft(values: FormValues) {
    try {
      await saveDraft(values);
      toast.success("Borrador guardado.");
    } catch {
      toast.error("No se pudo guardar el borrador.");
    }
  }

  async function handleNext(values: FormValues) {
    try {
      await saveDraft(values);
      setStep(2);
      onNext();
    } catch {
      toast.error("No se pudo guardar. Revisa los datos.");
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit(handleNext)}>
      {/* Título */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Título del curso <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          {...register("titulo")}
          placeholder="Ej: Introducción a Riesgos Operativos"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        {errors.titulo && <p className="text-xs text-red-500 mt-1">{errors.titulo.message}</p>}
      </div>

      {/* Descripción */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Descripción / objetivo</label>
        <textarea
          {...register("descripcion")}
          rows={3}
          placeholder="¿Qué aprenderá el participante?"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
        />
      </div>

      {/* Tipo + Área */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
          <select
            {...register("tipo")}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {Object.entries(TIPO_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Área</label>
          <select
            {...register("area", { valueAsNumber: true })}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Sin área específica</option>
            {areas.filter((a) => a.activo).map((a) => (
              <option key={a.id} value={a.id}>{a.nombre}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Fecha límite + Duración */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Fecha límite{" "}
            <span className="text-xs text-gray-400">(opcional)</span>
          </label>
          <input
            type="date"
            {...register("fecha_limite")}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Duración estimada (horas)</label>
          <input
            type="number"
            {...register("duracion_horas")}
            placeholder="Ej: 4"
            min={1}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Versión + Cert expira */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Versión</label>
          <input
            type="text"
            {...register("version")}
            placeholder="1.0"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {errors.version && <p className="text-xs text-red-500 mt-1">{errors.version.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            El certificado expira en{" "}
            <span className="text-xs text-gray-400">(meses, opcional)</span>
          </label>
          <input
            type="number"
            {...register("cert_expira_meses")}
            placeholder="Ej: 12"
            min={1}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={handleSubmit(handleSaveDraft)}
          disabled={saving}
          className="px-4 py-2 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar borrador"}
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          Siguiente →
        </button>
      </div>
    </form>
  );
}
