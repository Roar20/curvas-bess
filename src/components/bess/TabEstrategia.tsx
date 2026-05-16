import type { ResumenData } from "@/types/bess";
import { EstrategiaNarrativa } from "./EstrategiaNarrativa";
import { EstrategiaComparativaChart } from "./EstrategiaComparativaChart";
import { EstrategiaKPIs } from "./EstrategiaKPIs";
import { EstrategiaTablaTecnica } from "./EstrategiaTablaTecnica";

export function TabEstrategia({ data }: { data: ResumenData }) {
  if (!data.parte2) {
    return (
      <div className="bg-card rounded-xl border border-border p-6 text-muted-foreground">
        No se calculó la Parte 2. Vuelve al onboarding para regenerar el
        análisis.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-3xl font-semibold text-navy">
          Estrategia de despacho recomendada
        </h2>
        <p className="text-muted-foreground mt-1">
          Comparativa entre operación greedy y arbitraje en hora punta CFE.
        </p>
      </header>

      <EstrategiaNarrativa data={data} />
      <EstrategiaComparativaChart data={data} />
      <EstrategiaKPIs data={data} />
      <EstrategiaTablaTecnica data={data} />
    </div>
  );
}
