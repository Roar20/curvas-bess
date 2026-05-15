import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: string | number;
  unit?: string;
  hint?: string;
  variant?: "default" | "danger" | "success" | "highlight";
  className?: string;
}

export function MetricCard({ label, value, unit, hint, variant = "default", className }: Props) {
  const variants = {
    default: "border-border",
    danger: "border-warning/40 bg-warning/5",
    success: "border-success/40 bg-success/5",
    highlight: "border-sky/40 bg-sky/5",
  };
  return (
    <div className={cn("metric-card flex flex-col gap-1", variants[variant], className)}>
      <div className="metric-label">{label}</div>
      <div className="flex items-baseline gap-1.5">
        <div className="metric-value">{value}</div>
        {unit && <div className="text-sm font-medium text-muted-foreground">{unit}</div>}
      </div>
      {hint && <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}