import { useMemo } from "react";
import type { ResumenData, DiasDetalle } from "@/types/bess";
import { DespachoNarrativa } from "./DespachoNarrativa";
import { DespachoKPIs } from "./DespachoKPIs";
import { DespachoTablaTecnica, type FilaHora } from "./DespachoTablaTecnica";
import {
  Area,
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

function calcularPromediosHorarios(diario: DiasDetalle): FilaHora[] {
  const fechas = Object.keys(diario);
  const filas: FilaHora[] = Array.from({ length: 24 }, (_, h) => ({
    hora: h,
    gen: 0,
    excedente: 0,
    carga: 0,
    descarga: 0,
    soc: 0,
    perdido: 0,
  }));
  if (fechas.length === 0) return filas;
  for (const f of fechas) {
    const d = diario[f];
    if (!d) continue;
    for (let h = 0; h < 24; h++) {
      filas[h].gen += d.gen[h] ?? 0;
      filas[h].excedente += d.excedente[h] ?? 0;
      filas[h].carga += d.carga[h] ?? 0;
      filas[h].descarga += d.descarga[h] ?? 0;
      filas[h].soc += d.soc[h] ?? 0;
      filas[h].perdido += d.perdido[h] ?? 0;
    }
  }
  const n = fechas.length;
  for (let h = 0; h < 24; h++) {
    filas[h].gen /= n;
    filas[h].excedente /= n;
    filas[h].carga /= n;
    filas[h].descarga /= n;
    filas[h].soc /= n;
    filas[h].perdido /= n;
  }
  return filas;
}

type ChartTooltipProps = {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string | number;
};

function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div
      className="bg-card border border-border rounded-md p-2 text-xs space-y-1"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="font-semibold text-navy">Hora {label}:00</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span
            className="inline-block w-2 h-2 rounded-sm"
            style={{ background: p.color }}
          />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="tabular-nums font-medium">
            {new Intl.NumberFormat("es-MX", {
              maximumFractionDigits: 0,
            }).format(p.value)}{" "}
            kWh
          </span>
        </div>
      ))}
    </div>
  );
}

export function TabDespacho({ data }: { data: ResumenData }) {
  const filas = useMemo(
    () =>
      data.simulaciones?.dias_detalle
        ? calcularPromediosHorarios(
            data.simulaciones.dias_detalle as DiasDetalle,
          )
        : [],
    [data.simulaciones],
  );

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-3xl font-semibold text-navy">
          Cómo trabaja la batería en un día promedio
        </h2>
        <p className="text-muted-foreground mt-1">
          Una vista pensada para el cliente: dónde se almacena la energía y
          cuándo se entrega de vuelta.
        </p>
      </header>

      <DespachoNarrativa data={data} />

      <div
        className="bg-card rounded-xl border border-border p-5 space-y-3"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <div>
          <h3 className="text-lg font-semibold text-navy">
            Despacho diario promedio
          </h3>
          <p className="text-xs text-muted-foreground">
            Generación solar y operación de la batería hora por hora.
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
                  value: "kW",
                  angle: -90,
                  position: "insideLeft",
                  fill: "hsl(var(--muted-foreground))",
                  fontSize: 11,
                }}
              />
              <Tooltip content={<ChartTooltip />} />
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

              <Area
                type="monotone"
                dataKey="carga"
                name="Batería cargando"
                stroke="hsl(var(--charge))"
                fill="hsl(var(--charge))"
                fillOpacity={0.5}
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="descarga"
                name="Batería entregando energía"
                stroke="hsl(var(--soc))"
                fill="hsl(var(--soc))"
                fillOpacity={0.55}
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="gen"
                name="Generación solar"
                stroke="hsl(var(--pv))"
                strokeWidth={2.5}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="rounded-md border border-border bg-secondary/40 p-3">
            <span className="font-medium text-foreground">
              Aquí se almacena el sobrante.
            </span>{" "}
            <span className="text-muted-foreground">
              Durante el día, cuando la planta solar genera más de lo que la
              red puede recibir.
            </span>
          </div>
          <div className="rounded-md border border-border bg-secondary/40 p-3">
            <span className="font-medium text-foreground">
              Aquí se entrega al cliente final.
            </span>{" "}
            <span className="text-muted-foreground">
              En la tarde-noche, dentro de la hora punta de CFE, donde la
              energía vale más.
            </span>
          </div>
        </div>
      </div>

      <DespachoKPIs data={data} />

      <DespachoTablaTecnica filas={filas} />
    </div>
  );
}
