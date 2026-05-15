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

const SIM_KEYS = ["250_1000", "300_1200", "400_1600", "500_2000"] as const;

export function TabDecision({ data }: { data: ResumenData }) {
  const e = data.estadisticos_excedente;
  const sims = SIM_KEYS.map((k) => data.simulaciones[k] as SimulacionPre);

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-3xl font-semibold text-navy">Argumento técnico para el dimensionamiento</h2>
        <p className="text-muted-foreground mt-1">
          Toda la evidencia viene de los {fmtN(data.meta.registros_totales)} registros cincominutales de marzo 2026.
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
            conclusion="Capacidad útil objetivo ≈ 1 520 kWh → Nominal con DOD 95% ≈ 1 600 kWh"
          />
          <ReasoningCard
            title="2. ¿Qué tan rápido sobra?"
            subtitle="→ fija la potencia AC"
            rows={[
              ["Pico absoluto", `${e.pico_kW.toFixed(1)} kW`],
              ["P99 del excedente", `${e.p99_kW.toFixed(1)} kW`],
              ["P95 del excedente", `${e.p95_kW.toFixed(1)} kW`],
            ]}
            conclusion="Potencia mínima ≈ 250 kW. Subimos a 400 kW por la ventana de descarga (ver pregunta 3)."
          />
          <ReasoningCard
            title="3. ¿Cuántas horas opera la batería?"
            subtitle="→ fija el ratio P/E"
            rows={[
              ["Ventana de carga (promedio)", `${e.duracion_promedio_h.toFixed(2)} h`],
              ["Ventana de descarga", `${(24 - e.h_fin_promedio).toFixed(2)} h`],
              ["Ratio recomendado", "4 h (1C/4)"],
            ]}
            conclusion="4 h nominales → P/E = 0.25, descarga completa entre 17h y 21h."
          />
          <ReasoningCard
            title="4. ¿La batería se vacía cada noche?"
            subtitle="→ valida operación cíclica"
            rows={[
              ["SOC final del día", "0 kWh @ 21-22h"],
              ["Ciclos esperados/año", "343"],
              ["Vida útil estimada (LFP)", "17.5 años"],
            ]}
            conclusion="Sí: SOC vuelve a 0 cada noche → operación cíclica completa, sin sulfatación."
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
              const isReco = s.P_kW === 400 && s.E_kWh === 1600;
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

      <Callout variant="success" title="Configuración recomendada: 400 kW AC / 1 600 kWh / 4 h / LFP / DOD 95%">
        <ul className="list-disc pl-5 space-y-1">
          <li>Captura <strong>95.2% del excedente diario</strong>, que es el codo del Pareto.</li>
          <li>SOC alcanza 95% de la nominal solo 19 de 31 días → margen para días extremos.</li>
          <li>Descarga 4 horas a 400 kW justo en ventana 17h–21h (peak de demanda y PML).</li>
          <li>Ciclos esperados <strong>343/año</strong> → vida útil <strong>17.5 años</strong> con LFP.</li>
          <li>SOC vuelve a 0 cada noche → operación cíclica completa.</li>
          <li>Energía adicional al POI: <strong>38.8 MWh/mes (+26% vs sin BESS)</strong>.</li>
        </ul>
      </Callout>

      <Callout variant="warning" title="Limitaciones del análisis">
        <ol className="list-decimal pl-5 space-y-1">
          <li>Solo cubre marzo. Junio-agosto (lluvias) y diciembre-enero (días cortos) bajarán el excedente 30-40%.</li>
          <li>No considera la curva PML horaria — el modelo asume cobertura plana a $1011/MWh.</li>
          <li>No incluye CAPEX/OPEX para LCOE — falta el análisis económico.</li>
          <li>No modela degradación de la batería año a año.</li>
          <li>Si el BESS también va a hacer regulación de frecuencia, la potencia debería subir a 500 kW.</li>
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
        ✓ {conclusion}
      </div>
    </div>
  );
}