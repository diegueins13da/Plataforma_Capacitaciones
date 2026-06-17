import { differenceInDays, parseISO } from "date-fns";

interface UrgencyBadgeProps {
  fechaLimite: string | null;
  className?: string;
}

export function UrgencyBadge({ fechaLimite, className = "" }: UrgencyBadgeProps) {
  if (!fechaLimite) {
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 ${className}`}>
        Sin vencimiento
      </span>
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadline = parseISO(fechaLimite);
  const days = differenceInDays(deadline, today);

  if (days < 0) {
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium ${className}`}>
        Vencido
      </span>
    );
  }
  if (days === 0) {
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium ${className}`}>
        Vence hoy
      </span>
    );
  }
  if (days <= 7) {
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium ${className}`}>
        Vence en {days} día{days !== 1 ? "s" : ""}
      </span>
    );
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 ${className}`}>
      {days} días restantes
    </span>
  );
}
