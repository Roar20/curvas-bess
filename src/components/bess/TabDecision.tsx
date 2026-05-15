import { ResumenData, SimulacionPre } from "@/types/bess";
import { fmtN } from "@/lib/bess-sim";
import { Callout } from "./Callout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function isSimulacionPre(v: unknown): v is SimulacionPre {
  return (
    typeof v === "object" &&
    v !== null &&
    "P_kW" in v &&
    typeof (v as { P_kW: unknown }).P_kW === "number"
  );
}

export function TabDecision({ data }: { data: ResumenData }) {
  const e = data.estadisticos_excedente;
  const reco = data.recomendacion;
  const sims = Object.values(data.simulaciones)
    .filter(isSimulacionPre)
    .sort((a, b) => a.P_kW - b.P_kW);
  const simReco =
    sims.find((s) => s.P_kW === reco.P_kW && s.E_kWh === reco.E_kWh) ?? null;

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-3xl font-semibold text-navy">Argumento técnico para el dimensionamiento</h2>
        <p className="text-muted-foreground mt-1">
          Toda la evidencia viene de los {fmtN(data.meta.registros_totales)} registros cincominutales de {data.meta.periodo_analizado}.
        </p>
      </header>

      <div>
        <h3 className="text-xl font-semibold text-navy mb-4">El razonamiento en 4 preguntas</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <ReasoningCard
            title="1. ¿Cuánta energía sobra cada día?"
            subtitle="→ fija la capacidad útil"
            rows={[
              ["Mediana", `${fmtN(e.diario_mediana_kWh)} kWh`],
              ["P90", `${fmtN(e.diario_p90_kWh)} kWh`],
              ["Máximo", `${fmtN(e.diario_max_kWh)} kWh`],
            ]}
            conclusion={`Capacidad útil objetivo ≈ ${fmtN(reco.E_kWh * (reco.DOD_pct / 100), 0)} kWh — Nominal con DOD ${reco.DOD_pct}% ≈ ${fmtN(reco.E_kWh, 0)} kWh`}
          />
          <ReasoningCard
            title="2. ¿Qué tan rápido sobra?"
            subtitle="→ fija la potencia AC"
            rows={[
              ["Pico absoluto", `${e.pico_kW.toFixed(1)} kW`],
              ["P99 del excedente", `${e.p99_kW.toFixed(1)} kW`],
              ["P95 del excedente", `${e.p95_kW.toFixed(1)} kW`],
            ]}
            conclusion={`Potencia mínima ≈ ${fmtN(e.p99_kW, 0)} kW (P99). Recomendada: ${fmtN(reco.P_kW, 0)} kW por la ventana de descarga (ver pregunta 3).`}
          />
          <ReasoningCard
            title="3. ¿Cuántas horas opera la batería?"
            subtitle="→ fija el ratio P/E"
            rows={[
              ["Ventana de carga (promedio)", `${e.duracion_promedio_h.toFixed(2)} h`],
              ["Ventana de descarga", `${(24 - e.h_fin_promedio).toFixed(2)} h`],
              ["Ratio recomendado", `${reco.horas.toFixed(1)} h`],
            ]}
            conclusion={`${reco.horas.toFixed(1)} h nominales — P/E = ${(1 / reco.horas).toFixed(2)}, descarga completa después del ocaso.`}
          />
          <ReasoningCard
            title="4. ¿La batería se vacía cada noche?"
            subtitle="→ valida operación cíclica"
            rows={[
              ["SOC final del día", "0 kWh tras descarga"],
              ["Ciclos esperados/año", simReco ? fmtN(simReco.ciclos_ano, 0) : "—"],
              [
                `Vida útil estimada (${reco.tecnologia})`,
                simReco ? `${simReco.vida_util_anos.toFixed(1)} años` : "—",
              ],
            ]}
            conclusion="SOC vuelve a 0 cada noche — operación cíclica completa, sin sulfatación."
          />
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
        <h3 className="text-lg font-semibold text-navy p-5 pb-3">Comparativa de las 4 simulaciones</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Configuración</TableHead>
              <TableHead className="text-right">Cargado (MWh)</TableHead>
              <TableHead className="text-right">Perdido (MWh)</TableHead>
              <TableHead className="text-right">% Capt.</TableHead>
              <TableHead className="text-right">Días sat.</TableHead>
              <TableHead className="text-right">% Util.</TableHead>
              <TableHead className="text-right">Ciclos/año</TableHead>
              <TableHead className="text-right">Vida (años)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sims.map((s) => {
              const isReco = s.P_kW === reco.P_kW && s.E_kWh === reco.E_kWh;
              return (
                <TableRow key={`${s.P_kW}_${s.E_kWh}`} className={isReco ? "bg-success/10 font-medium" : ""}>
                  <TableCell>
                    <div className="font-medium">{s.nombre}</div>
                    <div className="text-xs text-muted-foreground">
                      {s.P_kW} kW / {s.E_kWh} kWh
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{(s.cargado_kWh / 1000).toFixed(1)}</TableCell>
                  <TableCell className="text-right tabular-nums">{(s.perdido_kWh / 1000).toFixed(1)}</TableCell>
                  <TableCell className="text-right tabular-nums">{s.pct_capturado.toFixed(1)}%</TableCell>
                  <TableCell className="text-right tabular-nums">{s.dias_saturado}</TableCell>
                  <TableCell className="text-right tabular-nums">{s.utilizacion_pct.toFixed(1)}%</TableCell>
                  <TableCell className="text-right tabular-nums">{s.ciclos_ano}</TableCell>
                  <TableCell className="text-right tabular-nums">{s.vida_util_anos.toFixed(1)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Callout
        variant="success"
        title={`Configuración recomendada: ${fmtN(reco.P_kW, 0)} kW AC / ${fmtN(reco.E_kWh, 0)} kWh / ${reco.horas.toFixed(1)} h / ${reco.tecnologia} / DOD ${reco.DOD_pct}%`}
      >
        <ul className="list-disc pl-5 space-y-1">
          {simReco && (
            <li>
              Captura{" "}
              <strong>{simReco.pct_capturado.toFixed(1)}% del excedente</strong>{" "}
              en el periodo analizado.
            </li>
          )}
          {simReco && (
            <li>
              SOC alcanza 90% de la nominal en{" "}
              <strong>
                {simReco.dias_saturado} de {data.meta.dias_analizados} días
              </strong>{" "}
              — margen para días extremos.
            </li>
          )}
          {simReco && (
            <li>
              Descarga {reco.horas.toFixed(1)} horas a {fmtN(reco.P_kW, 0)} kW
              en ventana de demanda alta.
            </li>
          )}
          {simReco && (
            <li>
              Ciclos esperados <strong>{fmtN(simReco.ciclos_ano, 0)}/año</strong>{" "}
              — vida útil{" "}
              <strong>{simReco.vida_util_anos.toFixed(1)} años</strong> con{" "}
              {reco.tecnologia}.
            </li>
          )}
          <li>SOC vuelve a 0 cada noche — operación cíclica completa.</li>
          {simReco && (
            <li>
              Energía adicional al POI:{" "}
              <strong>
                {fmtN(simReco.energia_extra_MWh_mes, 1)} MWh/mes
              </strong>
              .
            </li>
          )}
        </ul>
      </Callout>

      <Callout variant="warning" title="Limitaciones del análisis">
        <ol className="list-decimal pl-5 space-y-1">
          <li>
            Periodo analizado: <strong>{data.meta.periodo_analizado}</strong> ({data.meta.dias_analizados} días). Estacionalidad puede modificar el excedente fuera de este rango.
          </li>
          <li>No considera la curva PML horaria — el modelo asume cobertura plana al precio configurado.</li>
          <li>No incluye CAPEX/OPEX para LCOE — falta el análisis económico.</li>
          <li>No modela degradación de la batería año a año.</li>
          <li>Si el BESS también va a hacer regulación de frecuencia, la potencia debería subir.</li>
        </ol>
      </Callout>
    </div>
  );
}

function ReasoningCard({
  title, subtitle, rows, conclusion,
}: { title: string; subtitle: string; rows: [string, string][]; conclusion: string }) {
  return (
    <div className="bg-card rounded-xl border border-border p-5 space-y-3" style={{ boxShadow: "var(--shadow-card)" }}>
      <div>
        <h4 className="font-semibold text-navy">{title}</h4>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <div className="space-y-1.5 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between border-b border-border/60 pb-1">
            <span className="text-muted-foreground">{k}</span>
            <span className="font-medium tabular-nums">{v}</span>
          </div>
        ))}
      </div>
      <div className="text-sm bg-success/10 border border-success/30 rounded-lg px-3 py-2 text-foreground">
        {conclusion}
      </div>
    </div>
  );
}