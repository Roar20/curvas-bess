import type { ResumenData, SimulacionPre } from "@/types/bess";
import { fmtN, fmtMXN } from "@/lib/bess-sim";

function isSimulacionPre(v: unknown): v is SimulacionPre {
  return (
    typeof v === "object" &&
    v !== null &&
    "P_kW" in v &&
    typeof (v as { P_kW: unknown }).P_kW === "number"
  );
}

function Card({
  titulo,
  valor,
  unidad,
  unidadHint,
  subtexto,
}: {
  titulo: string;
  valor: string;
  unidad?: string;
  unidadHint?: string;
  subtexto: string;
}) {
  return (
    <div
      className="bg-card rounded-xl border border-border p-6 space-y-2"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="text-sm font-medium text-muted-foreground">{titulo}</div>
      <div className="flex items-baseline gap-2 flex-wrap">
        <div className="text-3xl font-semibold text-navy tabular-nums">
          {valor}
        </div>
        {unidad && (
          <div className="text-sm text-muted-foreground">{unidad}</div>
        )}
        {unidadHint && (
          <div className="text-xs text-muted-foreground">· {unidadHint}</div>
        )}
      </div>
      <div className="text-xs text-muted-foreground leading-relaxed">
        {subtexto}
      </div>
    </div>
  );
}

function calificadorCiclos(ciclos: number): string {
  if (ciclos < 200) return "uso conservador de la batería";
  if (ciclos < 365) return "uso moderado";
  return "uso intensivo (>1 ciclo/día promedio)";
}

export function DespachoKPIs({ data }: { data: ResumenData }) {
  const reco = data.simulaciones.recomendada;
  if (!isSimulacionPre(reco)) {
    return (
      <div className="text-sm text-muted-foreground">
        No hay datos de simulación recomendada.
      </div>
    );
  }

  const dias = data.meta.dias_analizados || 1;
  const energiaPorDia = reco.descargado_kWh / dias;
  // valor_extra_MXN_mes en cinco-min.ts es realmente el valor del periodo
  // analizado (descargado_kWh × precioMxnMwh / 1000), no estrictamente mensual.
  const valorAnual = reco.valor_extra_MXN_mes * (365 / dias);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card
        titulo="Energía adicional aprovechada"
        valor={fmtN(energiaPorDia, 0)}
        unidad="kWh por día"
        subtexto="Energía que sin la batería se perdería o se vendería barato."
      />
      <Card
        titulo="Valor anual capturado"
        valor={fmtMXN(valorAnual)}
        unidad="MXN"
        subtexto="Ingresos adicionales que el sistema genera al año."
      />
      <Card
        titulo="Ciclos al año"
        valor={fmtN(reco.ciclos_ano, 0)}
        unidad="ciclos"
        unidadHint={calificadorCiclos(reco.ciclos_ano)}
        subtexto="Cuántas veces la batería se carga y descarga al año. Una batería LFP típica soporta 6 000 ciclos antes de degradarse."
      />
    </div>
  );
}
