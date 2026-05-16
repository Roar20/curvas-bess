import type { ResumenData } from "@/types/bess";
import { fmtN, fmtMXN } from "@/lib/bess-sim";

function CardKPI({
  titulo,
  valorGreedy,
  valorArbitraje,
  unidad,
  destacarArbitraje,
}: {
  titulo: string;
  valorGreedy: string;
  valorArbitraje: string;
  unidad: string;
  destacarArbitraje: boolean;
}) {
  return (
    <div
      className="bg-card rounded-xl border border-border p-6 space-y-3"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="text-sm font-medium text-muted-foreground">{titulo}</div>
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-muted-foreground">Greedy</span>
          <div className="text-lg font-medium text-foreground tabular-nums">
            {valorGreedy}
            <span className="text-xs text-muted-foreground ml-1">{unidad}</span>
          </div>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-muted-foreground">Arbitraje</span>
          <div
            className={`text-2xl font-semibold tabular-nums ${
              destacarArbitraje ? "text-navy" : "text-foreground"
            }`}
          >
            {valorArbitraje}
            <span className="text-xs text-muted-foreground ml-1">{unidad}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function EstrategiaKPIs({ data }: { data: ResumenData }) {
  const p2 = data.parte2!;
  const g = p2.greedy.ingreso;
  const a = p2.arbitraje.ingreso;
  const arbGana = p2.ganadora === "arbitraje";

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <CardKPI
        titulo="Ingreso anual total"
        valorGreedy={fmtMXN(g.total_mxn)}
        valorArbitraje={fmtMXN(a.total_mxn)}
        unidad="MXN"
        destacarArbitraje={arbGana}
      />
      <CardKPI
        titulo="Energía descargada al año"
        valorGreedy={fmtN(g.descargado_mwh_anual, 1)}
        valorArbitraje={fmtN(a.descargado_mwh_anual, 1)}
        unidad="MWh"
        destacarArbitraje={arbGana}
      />
      <CardKPI
        titulo="Potencia firme garantizable"
        valorGreedy={fmtN(g.kw_firme_garantizable, 0)}
        valorArbitraje={fmtN(a.kw_firme_garantizable, 0)}
        unidad="kW"
        destacarArbitraje={arbGana}
      />
    </div>
  );
}
