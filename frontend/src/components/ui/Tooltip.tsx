import { type ReactNode } from "react";

interface TooltipProps {
  label: string;
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
}

const POSITIONS = {
  top:    "bottom-full left-1/2 -translate-x-1/2 mb-2",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
  right:  "left-full top-1/2 -translate-y-1/2 ml-2.5",
  left:   "right-full top-1/2 -translate-y-1/2 mr-2.5",
};

export function Tooltip({ label, children, side = "top", className = "" }: TooltipProps) {
  return (
    <div className={`relative group/tt inline-flex ${className}`}>
      {children}
      <span
        role="tooltip"
        className={[
          "pointer-events-none absolute z-[300]",
          "px-2.5 py-1.5 rounded-lg",
          "text-[11px] font-semibold leading-none whitespace-nowrap",
          "bg-foreground text-background",
          "shadow-xl ring-1 ring-border/20",
          "opacity-0 group-hover/tt:opacity-100",
          "transition-opacity duration-150 delay-500",
          POSITIONS[side],
        ].join(" ")}
      >
        {label}
      </span>
    </div>
  );
}
