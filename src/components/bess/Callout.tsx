import { cn } from "@/lib/utils";

type Variant = "info" | "warning" | "success";

export function Callout({
  variant = "info",
  title,
  children,
}: {
  variant?: Variant;
  title?: string;
  children: React.ReactNode;
}) {
  const styles: Record<Variant, string> = {
    info: "border-sky/30 bg-sky/5",
    warning: "border-pv/40 bg-pv/10",
    success: "border-success/40 bg-success/5",
  };
  const barColor: Record<Variant, string> = {
    info: "bg-sky",
    warning: "bg-warning",
    success: "bg-success",
  };
  return (
    <div className={cn("rounded-xl border p-5 flex gap-4", styles[variant])}>
      <div className={cn("w-1 rounded-full shrink-0", barColor[variant])} />
      <div className="space-y-2 text-sm leading-relaxed text-foreground flex-1">
        {title && <div className="font-semibold text-navy">{title}</div>}
        <div className="space-y-2">{children}</div>
      </div>
    </div>
  );
}
