import { useCourseWizardStore } from "../../../../store/courseWizardStore";

interface Props {
  onNext: () => void;
  onBack: () => void;
}

export function Step3Assessment({ onNext, onBack }: Props) {
  const { step3, setStep3, setStep } = useCourseWizardStore();

  return (
    <div className="space-y-5">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
        El banco de preguntas se configura en el siguiente paso del desarrollo (T21).
        Aquí defines la política de evaluación.
      </div>

      {/* Puntaje mínimo */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Puntaje mínimo para aprobar (%)
        </label>
        <input
          type="number"
          value={step3.puntaje_minimo}
          onChange={(e) => setStep3({ puntaje_minimo: e.target.value })}
          min={1}
          max={100}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Intentos máximos */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Intentos máximos{" "}
          <span className="text-xs text-gray-400">(0 = ilimitados)</span>
        </label>
        <input
          type="number"
          value={step3.max_intentos}
          onChange={(e) => setStep3({ max_intentos: e.target.value })}
          min={0}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Tiempo límite */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Tiempo límite (minutos){" "}
          <span className="text-xs text-gray-400">(opcional)</span>
        </label>
        <input
          type="number"
          value={step3.tiempo_limite_minutos}
          onChange={(e) => setStep3({ tiempo_limite_minutos: e.target.value })}
          placeholder="Sin límite de tiempo"
          min={1}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Actions */}
      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={() => { setStep(2); onBack(); }}
          className="px-4 py-2 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50"
        >
          ← Anterior
        </button>
        <button
          type="button"
          onClick={() => { setStep(4); onNext(); }}
          className="px-6 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
        >
          Siguiente →
        </button>
      </div>
    </div>
  );
}
