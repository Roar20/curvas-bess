import { ResumenData } from "@/types/bess";
import { MetricCard } from "./MetricCard";
import { Callout } from "./Callout";
import { fmtN } from "@/lib/bess-sim";

export function TabResumen({ data }: { data: ResumenData }) {
  const r = data.recurso_pv;
  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-3xl font-semibold text-navy">
          Caracterización del recurso PV — {data.meta.periodo_analizado}
        </h2>
        <p className="text-muted-foreground mt-1">
          {data.meta.sitio} · {data.meta.ubicacion} · {fmtN(data.meta.registros_totales)} registros cincominutales
        </p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Energía PV bruta" value={fmtN(r.energia_pv_bruta_MWh, 1)} unit="MWh" />
        <MetricCard label="Entregada al POI" value={fmtN(r.energia_al_poi_MWh, 1)} unit="MWh" />
        <MetricCard
          label="Curtailment (perdido)"
          value={fmtN(r.curtailment_MWh, 1)}
          unit="MWh"
          hint={`${r.curtailment_pct.toFixed(1)}% del total`}
          variant="danger"
        />
        <MetricCard label="Factor de planta" value={r.factor_planta_pct.toFixed(1)} unit="%" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Techo POI" value={fmtN(r.POI_kW)} unit="kW" />
        <MetricCard label="Pico PV" value={fmtN(r.pico_pv_kW)} unit="kW" />
        <MetricCard label="PV instalada" value={fmtN(r.cap_pv_total_kW)} unit="kW" />
        <MetricCard label="Horas sol / día" value={r.horas_sol_diarias_promedio.toFixed(2)} unit="h" />
      </div>

      <Callout variant="info">
        <p>
          <strong>De cada 100 kWh que la PV produce, {r.curtailment_pct.toFixed(1)} kWh se pierden</strong>{" "}
          porque el techo POI de {fmtN(r.POI_kW)} kW recorta los picos. Ese {r.curtailment_pct.toFixed(1)}% es
          el target técnico del BESS: capturarlo y desplazarlo a horas sin sol.
        </p>
      </Callout>
    </div>
  );
}