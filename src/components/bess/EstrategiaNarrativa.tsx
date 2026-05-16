import type { ResumenData } from "@/types/bess";
import { fmtMXN, fmtN } from "@/lib/bess-sim";

export function EstrategiaNarrativa({ data }: { data: ResumenData }) {
  const p2 = data.parte2!;
  const ganadora = p2[p2.ganadora];
  const otra = p2[p2.ganadora === "arbitraje" ? "greedy" : "arbitraje"];
  const ventaja = p2.ventaja_mxn_anual;

  const nombreGanadora = p2.ganadora === "arbitraje" ? "Arbitraje" : "Greedy";
  const explicacionGanadora =
    p2.ganadora === "arbitraje"
      ? "cargar la batería durante el día con energía generable y descargarla en hora punta CFE (18h-22h)"
      : "cargar la batería solo con el sobrante físico cuando la generación supera el POI";

  return (
    <div className="bg-card rounded-xl border border-border p-6 leading-relaxed text-base text-foreground">
      Para esta planta, la estrategia recomendada es{" "}
      <strong className="text-navy">{nombreGanadora}</strong>:{" "}
      {explicacionGanadora}. Esta estrategia genera{" "}
      <strong>{fmtMXN(ventaja)} MXN al año más</strong> que la alternativa,
      principalmente por la capacidad firme reconocida en hora punta (
      {fmtN(ganadora.ingreso.kw_firme_garantizable, 0)} kW garantizables vs{" "}
      {fmtN(otra.ingreso.kw_firme_garantizable, 0)} kW).
    </div>
  );
}
