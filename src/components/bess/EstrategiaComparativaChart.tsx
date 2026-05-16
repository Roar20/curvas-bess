import type { ResumenData } from "@/types/bess";
import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const HORA_PUNTA_INI = 18;
const HORA_PUNTA_FIN = 22;

export function EstrategiaComparativaChart({ data }: { data: ResumenData }) {
  const p2 = data.parte2!;
  const diarioGreedy = p2.greedy.sim.diario;
  const diarioArbitraje = p2.arbitraje.sim.diario;

  const fechas = Object.keys(diarioGreedy);
  const n = fechas.length || 1;

  const filas = Array.from({ length: 24 }, (_, h) => {
    let descGreedy = 0;
    let descArb = 0;
    for (const f of fechas) {
      descGreedy += diarioGreedy[f]?.descarga[h] ?? 0;
      descArb += diarioArbitraje[f]?.descarga[h] ?? 0;
    }
    return {
      hora: h,
      greedy: descGreedy / n,
      arbitraje: descArb / n,
    };
  });

  return (
    <div
      className="bg-card rounded-xl border border-border p-5 space-y-3"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div>
        <h3 className="text-lg font-semibold text-navy">
          Descarga horaria promedio: greedy vs arbitraje
        </h3>
        <p className="text-xs text-muted-foreground">
          Promedio de descarga al POI por hora del día sobre el periodo
          analizado.
        </p>
      </div>

      <div style={{ width: "100%", height: 380 }}>
        <ResponsiveContainer>
          <ComposedChart
            data={filas}
            margin={{ top: 30, right: 30, left: 0, bottom: 5 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
            />
            <XAxis
              dataKey="hora"
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickFormatter={(h) => `${h}h`}
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              label={{
                value: "kWh",
                angle: -90,
                position: "insideLeft",
                fill: "hsl(var(--muted-foreground))",
                fontSize: 11,
              }}
            />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 12 }} />

            <ReferenceArea
              x1={HORA_PUNTA_INI}
              x2={HORA_PUNTA_FIN}
              fill="hsl(var(--soc))"
              fillOpacity={0.1}
              label={{
                value: "Hora punta CFE",
                position: "insideTop",
                fill: "hsl(var(--soc))",
                fontSize: 11,
              }}
            />

            <Line
              type="monotone"
              dataKey="greedy"
              name="Greedy"
              stroke="hsl(var(--muted-foreground))"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="arbitraje"
              name="Arbitraje (recomendada)"
              stroke="hsl(var(--soc))"
              strokeWidth={2.5}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
