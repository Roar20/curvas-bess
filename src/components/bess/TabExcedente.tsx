import { ResumenData } from "@/types/bess";
import { MetricCard } from "./MetricCard";
import { fmtN } from "@/lib/bess-sim";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const THRESHOLD = 1520;
const BINS = [
  { label: "0-500", min: 0, max: 500 },
  { label: "500-1000", min: 500, max: 1000 },
  { label: "1000-1250", min: 1000, max: 1250 },
  { label: "1250-1500", min: 1250, max: 1500 },
  { label: "1500-1750", min: 1500, max: 1750 },
  { label: "1750-2000", min: 1750, max: 2000 },
  { label: "2000-2500", min: 2000, max: 2500 },
];

export function TabExcedente({ data }: { data: ResumenData }) {
  const e = data.estadisticos_excedente;

  const histo = BINS.map((b) => ({
    rango: b.label,
    dias: data.excedente_diario.filter((d) => d.excedente_kWh >= b.min && d.excedente_kWh < b.max).length,
  }));

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-3xl font-semibold text-navy">¿Cuánto excedente sobra cada día?</h2>
        <p className="text-muted-foreground mt-1">
          La distribución diaria del excedente fija el target de capacidad útil del BESS.
        </p>
      </header>

      <div className="bg-card rounded-xl border border-border p-5" style={{ boxShadow: "var(--shadow-card)" }}>
        <h3 className="text-lg font-semibold text-navy mb-4">Excedente por día (kWh)</h3>
        <div style={{ width: "100%", height: 400 }}>
          <ResponsiveContainer>
            <BarChart data={data.excedente_diario} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="dia" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(value: number, name: string, item: any) => {
                  const p = item?.payload || {};
                  return [
                    <div key="t">
                      <div>Excedente: {fmtN(p.excedente_kWh, 1)} kWh</div>
                      <div>Pico: {fmtN(p.pico_kW, 1)} kW</div>
                      <div>Duración: {p.duracion_h} h</div>
                    </div>,
                    `Día ${p.dia}`,
                  ];
                }}
              />
              <ReferenceLine
                y={THRESHOLD}
                stroke="hsl(var(--warning))"
                strokeDasharray="6 4"
                label={{
                  value: "Capacidad útil BESS recomendada (1600 × 95% DOD = 1520 kWh)",
                  position: "insideTopRight",
                  fill: "hsl(var(--warning))",
                  fontSize: 11,
                }}
              />
              <Bar dataKey="excedente_kWh" radius={[4, 4, 0, 0]}>
                {data.excedente_diario.map((d) => (
                  <Cell
                    key={d.fecha}
                    fill={d.excedente_kWh > THRESHOLD ? "hsl(var(--navy-light))" : "hsl(var(--sky-soft))"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Promedio diario" value={fmtN(e.diario_promedio_kWh)} unit="kWh" />
        <MetricCard label="Mediana" value={fmtN(e.diario_mediana_kWh)} unit="kWh" />
        <MetricCard label="P90" value={fmtN(e.diario_p90_kWh)} unit="kWh" />
        <MetricCard label="Día crítico (máx)" value={fmtN(e.diario_max_kWh)} unit="kWh" variant="danger" />
      </div>

      <div className="bg-card rounded-xl border border-border p-5" style={{ boxShadow: "var(--shadow-card)" }}>
        <h3 className="text-lg font-semibold text-navy mb-4">Distribución de días por rango de excedente</h3>
        <div style={{ width: "100%", height: 280 }}>
          <ResponsiveContainer>
            <BarChart data={histo}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="rango" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Bar dataKey="dias" fill="hsl(var(--sky))" radius={[4, 4, 0, 0]} name="Días" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <Accordion type="single" collapsible className="bg-card rounded-xl border border-border px-5">
        <AccordionItem value="t" className="border-0">
          <AccordionTrigger className="text-navy font-semibold">
            Tabla completa de los 31 días
          </AccordionTrigger>
          <AccordionContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Excedente (kWh)</TableHead>
                  <TableHead className="text-right">Pico (kW)</TableHead>
                  <TableHead className="text-right">Inicio</TableHead>
                  <TableHead className="text-right">Fin</TableHead>
                  <TableHead className="text-right">Duración (h)</TableHead>
                  <TableHead className="text-right">Gen PV (kWh)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.excedente_diario.map((d) => (
                  <TableRow key={d.fecha}>
                    <TableCell>{d.fecha}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtN(d.excedente_kWh, 1)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtN(d.pico_kW, 1)}</TableCell>
                    <TableCell className="text-right tabular-nums">{d.h_inicio}</TableCell>
                    <TableCell className="text-right tabular-nums">{d.h_fin}</TableCell>
                    <TableCell className="text-right tabular-nums">{d.duracion_h}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtN(d.gen_PV_kWh, 1)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}