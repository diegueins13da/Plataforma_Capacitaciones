import { differenceInDays, parseISO } from "date-fns";

interface UrgencyBadgeProps {
  fechaLimite: string | null;
  className?: string;
}

export function UrgencyBadge({ fechaLimite, className = "" }: UrgencyBadgeProps) {
  if (!fechaLimite) {
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full bg-muted/40 text-muted-foreground ${className}`}>
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
      <span className={`text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 font-medium ${className}`}>
        Vencido
      </span>
    );
  }
  if (days === 0) {
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 font-medium ${className}`}>
        Vence hoy
      </span>
    );
  }
  if (days <= 7) {
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-medium ${className}`}>
        Vence en {days} día{days !== 1 ? "s" : ""}
      </span>
    );
  }
  if (days <= 30) {
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 ${className}`}>
        Vence en {days} días
      </span>
    );
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 ${className}`}>
      Vence en {days} días
    </span>
  );
}
