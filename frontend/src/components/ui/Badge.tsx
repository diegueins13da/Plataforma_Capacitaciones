import { type HTMLAttributes } from "react";

type BadgeVariant = "default" | "primary" | "success" | "warning" | "danger" | "muted" | "outline";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const BASE = "inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full leading-none whitespace-nowrap";

const VARIANTS: Record<BadgeVariant, string> = {
  default:     "bg-primary/15 text-primary",
  primary:     "bg-primary/15 text-primary",
  success:     "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  warning:     "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  danger:      "bg-red-500/15 text-red-600 dark:text-red-400",
  muted:       "bg-muted text-muted-foreground",
  outline:     "border border-border text-muted-foreground bg-transparent",
};

export function Badge({
  variant = "default",
  className = "",
  children,
  ...props
}: BadgeProps) {
  return (
    <span className={[BASE, VARIANTS[variant], className].join(" ")} {...props}>
      {children}
    </span>
  );
}
