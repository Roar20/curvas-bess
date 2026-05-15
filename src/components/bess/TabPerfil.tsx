import { ResumenData } from "@/types/bess";
import { hourToHHMM } from "@/lib/bess-sim";
import { HeatmapDiaHora } from "./HeatmapDiaHora";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";

export function TabPerfil({ data, P_kW, E_kWh }: { data: ResumenData; P_kW: number; E_kWh: number }) {
  const e = data.estadisticos_excedente;
  const horasDescarga = E_kWh / P_kW;
  const ventanaDesc = 24 - e.h_fin_promedio;
  const margen = ventanaDesc - horasDescarga;

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-3xl font-semibold text-navy">Perfil horario promedio del mes</h2>
        <p className="text-muted-foreground mt-1">
          Generación promedio y máxima por hora — define las ventanas de carga y descarga.
        </p>
      </header>

      <div className="bg-card rounded-xl border border-border p-5" style={{ boxShadow: "var(--shadow-card)" }}>
        <div style={{ width: "100%", height: 420 }}>
          <ResponsiveContainer>
            <ComposedChart data={data.perfil_horario} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="hora"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickFormatter={(h) => `${h}h`}
              />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelFormatter={(h) => `Hora ${h}:00`}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />

              <ReferenceArea
                x1={9}
                x2={16.5}
                y1={0}
                fill="hsl(var(--charge))"
                fillOpacity={0.12}
                label={{ value: "Ventana de carga", position: "insideTop", fill: "hsl(var(--success))", fontSize: 11 }}
              />
              <ReferenceArea
                x1={17}
                x2={22}
                y1={0}
                fill="hsl(var(--soc))"
                fillOpacity={0.1}
                label={{ value: "Ventana de descarga", position: "insideTop", fill: "hsl(var(--soc))", fontSize: 11 }}
              />

              <Area
                type="monotone"
                dataKey="gen_kW_avg"
                name="Gen promedio"
                fill="hsl(var(--pv))"
                fillOpacity={0.55}
                stroke="hsl(var(--pv))"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="gen_kW_max"
                name="Gen máximo"
                stroke="hsl(var(--warning))"
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={false}
              />
              <ReferenceLine
                y={500}
                stroke="hsl(var(--navy))"
                strokeWidth={1.5}
                label={{ value: "Techo POI 500 kW", position: "right", fill: "hsl(var(--navy))", fontSize: 11 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div
          className="bg-card rounded-xl border border-border p-5 space-y-2"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <h3 className="font-semibold text-navy flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-sm bg-charge" />
            Ventana de carga
          </h3>
          <div className="grid grid-cols-2 gap-y-1 text-sm">
            <span className="text-muted-foreground">Inicio promedio:</span>
            <span className="font-medium tabular-nums">{hourToHHMM(e.h_inicio_promedio)}</span>
            <span className="text-muted-foreground">Fin promedio:</span>
            <span className="font-medium tabular-nums">{hourToHHMM(e.h_fin_promedio)}</span>
            <span className="text-muted-foreground">Duración promedio:</span>
            <span className="font-medium tabular-nums">{e.duracion_promedio_h.toFixed(2)} h</span>
          </div>
        </div>

        <div
          className="bg-card rounded-xl border border-border p-5 space-y-2"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <h3 className="font-semibold text-navy flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-sm bg-soc" />
            Ventana de descarga
          </h3>
          <div className="grid grid-cols-2 gap-y-1 text-sm">
            <span className="text-muted-foreground">Horas hasta medianoche:</span>
            <span className="font-medium tabular-nums">{ventanaDesc.toFixed(2)} h</span>
            <span className="text-muted-foreground">Horas para vaciarse ({P_kW}/{E_kWh}):</span>
            <span className="font-medium tabular-nums">{horasDescarga.toFixed(2)} h</span>
            <span className="text-muted-foreground">Margen:</span>
            <span className="font-medium tabular-nums">
              {margen >= 0 ? "+" : ""}
              {margen.toFixed(2)} h
            </span>
          </div>
          <div className="pt-1">
            {margen >= 0 ? (
              <Badge className="bg-success text-white hover:bg-success">Cabe en la ventana</Badge>
            ) : (
              <Badge variant="destructive">No cabe en la ventana</Badge>
            )}
          </div>
        </div>
      </div>

      <div
        className="bg-card rounded-xl border border-border p-5 space-y-2"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <div>
          <h3 className="text-lg font-semibold text-navy">
            Mapa de calor: kW promedio por día × hora
          </h3>
          <p className="text-xs text-muted-foreground">
            Cada celda es la potencia promedio durante esa hora en ese día (o
            semana si el periodo es largo). Las celdas más rojas marcan los
            momentos de mayor inyección.
          </p>
        </div>
        <HeatmapDiaHora data={data} />
      </div>
    </div>
  );
}