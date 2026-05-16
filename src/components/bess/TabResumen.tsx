import { ResumenData } from "@/types/bess";
import { MetricCard } from "./MetricCard";
import { Callout } from "./Callout";
import { fmtN } from "@/lib/bess-sim";
import { storage } from "@/lib/storage";

export function TabResumen({ data }: { data: ResumenData }) {
  const r = data.recurso_pv;
  const estado = storage.cargarAnalisis();
  const pvTotal = r.cap_pv_total_kW;
  const pvActual = estado?.cliente.cap_pv_instalada_kw ?? pvTotal;
  const pvAdicional = Math.max(0, pvTotal - pvActual);
  const sinOverbuild = pvAdicional <= 0;

  const subtextoPV = sinOverbuild
    ? "Sin overbuild propuesto"
    : `${fmtN(pvActual)} actual + ${fmtN(pvAdicional)} propuesta`;

  const badgeText = sinOverbuild
    ? `Escenario propuesto: PV ${fmtN(pvActual)} kW sin overbuild`
    : `Escenario propuesto: PV ${fmtN(pvActual)} + ${fmtN(pvAdicional)} kW de overbuild`;

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <div>
          <h2 className="text-3xl font-semibold text-navy">
            Caracterización del recurso PV — {data.meta.periodo_analizado}
          </h2>
          <p className="text-muted-foreground mt-1">
            {data.meta.sitio} · {data.meta.ubicacion} ·{" "}
            {fmtN(data.meta.registros_totales)} registros cincominutales
          </p>
        </div>
        <span className="inline-block px-2 py-1 rounded-md text-xs font-medium bg-sky/10 text-sky border border-sky/20">
          {badgeText}
        </span>
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
        <MetricCard
          label="PV total proyecto"
          value={fmtN(pvTotal)}
          unit="kW"
          hint={subtextoPV}
        />
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