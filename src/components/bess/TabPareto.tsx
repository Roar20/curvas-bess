import { ResumenData } from "@/types/bess";
import { fmtN } from "@/lib/bess-sim";
import { Callout } from "./Callout";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function TabPareto({ data }: { data: ResumenData }) {
  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-3xl font-semibold text-navy">
          Frente de Pareto: ¿cuánto BESS para capturar X% del excedente?
        </h2>
        <p className="text-muted-foreground mt-1">
          Cada punto es una configuración con ratio de 4 h (potencia = capacidad / 4).
        </p>
      </header>

      <div className="bg-card rounded-xl border border-border p-5" style={{ boxShadow: "var(--shadow-card)" }}>
        <div style={{ width: "100%", height: 420 }}>
          <ResponsiveContainer>
            <LineChart data={data.pareto} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="E_kWh"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                label={{ value: "Capacidad (kWh)", position: "insideBottom", offset: -2, fontSize: 12 }}
              />
              <YAxis
                domain={[0, 105]}
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                label={{ value: "% capturado", angle: -90, position: "insideLeft", fontSize: 12 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(value: number, _n, item: any) => {
                  const p = item?.payload || {};
                  return [`${value.toFixed(2)}% capturado`, `${p.P_kW} kW / ${p.E_kWh} kWh`];
                }}
                labelFormatter={() => ""}
              />
              <ReferenceLine
                y={95}
                stroke="hsl(var(--success))"
                strokeDasharray="6 4"
                label={{ value: "Codo del Pareto (95%)", position: "left", fill: "hsl(var(--success))", fontSize: 11 }}
              />
              <Line
                type="monotone"
                dataKey="pct_capturado"
                stroke="hsl(var(--navy-light))"
                strokeWidth={2.5}
                dot={{ r: 4, fill: "hsl(var(--navy-light))" }}
                activeDot={{ r: 6 }}
              />
              <ReferenceDot x={1600} y={95.23} r={9} fill="hsl(var(--warning))" stroke="white" strokeWidth={2}>
                <></>
              </ReferenceDot>
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="text-center mt-2 text-sm text-warning font-medium">
          ★ Recomendación: 400 kW / 1 600 kWh — 95.2% capturado
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Potencia (kW)</TableHead>
              <TableHead>Capacidad (kWh)</TableHead>
              <TableHead className="text-right">% Capturado</TableHead>
              <TableHead className="text-right">Cargado (kWh)</TableHead>
              <TableHead className="text-right">Perdido (kWh)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.pareto.map((p) => (
              <TableRow key={p.E_kWh} className={p.E_kWh === 1600 ? "bg-warning/5" : ""}>
                <TableCell className="tabular-nums">{p.P_kW}</TableCell>
                <TableCell className="tabular-nums font-medium">{p.E_kWh}</TableCell>
                <TableCell className="text-right tabular-nums">{p.pct_capturado.toFixed(2)}%</TableCell>
                <TableCell className="text-right tabular-nums">{fmtN(p.cargado_kWh)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtN(p.perdido_kWh)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Callout variant="info">
        <p>
          Pasar de <strong>1 600 kWh (95%)</strong> a <strong>2 000 kWh (100%)</strong> cuesta +25% de capacidad y
          solo aporta +5% de captura. La eficiencia marginal cae abruptamente después de 1 600 kWh.{" "}
          <strong>El codo del Pareto está exactamente ahí.</strong>
        </p>
      </Callout>
    </div>
  );
}