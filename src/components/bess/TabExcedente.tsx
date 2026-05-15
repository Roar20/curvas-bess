import { useMemo, useState } from "react";
import { ResumenData } from "@/types/bess";
import { MetricCard } from "./MetricCard";
import { fmtN } from "@/lib/bess-sim";
import {
  agregarPorGranularidad,
  granularidadDefault,
  granularidadesDisponibles,
  ETIQUETA_GRAN,
  PLURAL_GRAN,
  ARTICULO_PLURAL_GRAN,
  type Bucket,
  type Granularidad,
} from "@/lib/agregaciones";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

type TooltipPayloadItem = { payload: Bucket };
type TooltipProps = { active?: boolean; payload?: TooltipPayloadItem[] };

function BucketTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const b = payload[0].payload;
  return (
    <div
      className="bg-card border border-border rounded-lg p-3 text-xs space-y-1"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="font-semibold text-navy">{b.etiqueta}</div>
      <div className="text-muted-foreground">
        {b.fechaInicio} a {b.fechaFin}
      </div>
      <div>
        Excedente:{" "}
        <span className="font-medium tabular-nums">
          {fmtN(b.excedente_kWh, 1)} kWh
        </span>
      </div>
      <div>
        Pico:{" "}
        <span className="font-medium tabular-nums">
          {fmtN(b.pico_kW, 1)} kW
        </span>
      </div>
      <div>
        Días con excedente:{" "}
        <span className="font-medium tabular-nums">
          {b.dias_con_excedente} de {b.dias_totales}
        </span>
      </div>
      <div>
        Mejor día:{" "}
        <span className="font-medium tabular-nums">
          {b.mejor_dia.fecha} · {fmtN(b.mejor_dia.excedente_kWh, 0)} kWh
        </span>
      </div>
      <div>
        Peor día:{" "}
        <span className="font-medium tabular-nums">
          {b.peor_dia.fecha} · {fmtN(b.peor_dia.excedente_kWh, 0)} kWh
        </span>
      </div>
    </div>
  );
}

export function TabExcedente({ data }: { data: ResumenData }) {
  const e = data.estadisticos_excedente;
  const dias = data.meta.dias_analizados;
  const disponibles = useMemo(() => granularidadesDisponibles(dias), [dias]);
  const [gran, setGran] = useState<Granularidad>(() => {
    const def = granularidadDefault(dias);
    return disponibles.includes(def)
      ? def
      : disponibles[disponibles.length - 1];
  });

  const buckets = useMemo(
    () => agregarPorGranularidad(data.excedente_diario, gran),
    [data.excedente_diario, gran],
  );

  const histo = useMemo(
    () =>
      BINS.map((b) => ({
        rango: b.label,
        dias: data.excedente_diario.filter(
          (d) => d.excedente_kWh >= b.min && d.excedente_kWh < b.max,
        ).length,
      })),
    [data.excedente_diario],
  );

  const esDia = gran === "dia";
  const tituloCard = `Excedente por ${ETIQUETA_GRAN[gran].toLowerCase()} (kWh)`;
  const tituloTabla = `Tabla completa de ${ARTICULO_PLURAL_GRAN[gran]} ${buckets.length} ${PLURAL_GRAN[gran]}`;

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-3xl font-semibold text-navy">
          ¿Cuánto excedente sobra cada día?
        </h2>
        <p className="text-muted-foreground mt-1">
          La distribución diaria del excedente fija el target de capacidad útil
          del BESS.
        </p>
      </header>

      <div
        className="bg-card rounded-xl border border-border p-5"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <Tabs
          value={gran}
          onValueChange={(v) => setGran(v as Granularidad)}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h3 className="text-lg font-semibold text-navy">{tituloCard}</h3>
            <TabsList className="h-auto bg-secondary/40 border border-border p-1 rounded-lg">
              {disponibles.map((g) => (
                <TabsTrigger
                  key={g}
                  value={g}
                  className="data-[state=active]:bg-navy data-[state=active]:text-white px-3 py-1 text-sm"
                >
                  {ETIQUETA_GRAN[g]}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </Tabs>

        <div style={{ width: "100%", height: 400 }}>
          <ResponsiveContainer>
            <BarChart
              data={buckets}
              margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="etiqueta"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                interval="preserveStartEnd"
              />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip content={<BucketTooltip />} />
              {esDia && (
                <ReferenceLine
                  y={THRESHOLD}
                  stroke="hsl(var(--warning))"
                  strokeDasharray="6 4"
                  label={{
                    value:
                      "Capacidad útil BESS recomendada (1600 × 95% DOD = 1520 kWh)",
                    position: "insideTopRight",
                    fill: "hsl(var(--warning))",
                    fontSize: 11,
                  }}
                />
              )}
              <Bar dataKey="excedente_kWh" radius={[4, 4, 0, 0]}>
                {buckets.map((b) => (
                  <Cell
                    key={`${b.fechaInicio}-${b.fechaFin}`}
                    fill={
                      esDia && b.excedente_kWh > THRESHOLD
                        ? "hsl(var(--navy-light))"
                        : "hsl(var(--sky-soft))"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Promedio diario"
          value={fmtN(e.diario_promedio_kWh)}
          unit="kWh"
        />
        <MetricCard
          label="Mediana"
          value={fmtN(e.diario_mediana_kWh)}
          unit="kWh"
        />
        <MetricCard label="P90" value={fmtN(e.diario_p90_kWh)} unit="kWh" />
        <MetricCard
          label="Día crítico (máx)"
          value={fmtN(e.diario_max_kWh)}
          unit="kWh"
          variant="danger"
        />
      </div>

      <div
        className="bg-card rounded-xl border border-border p-5"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <h3 className="text-lg font-semibold text-navy mb-4">
          Distribución de días por rango de excedente
        </h3>
        <div style={{ width: "100%", height: 280 }}>
          <ResponsiveContainer>
            <BarChart data={histo}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
              />
              <XAxis
                dataKey="rango"
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Bar
                dataKey="dias"
                fill="hsl(var(--sky))"
                radius={[4, 4, 0, 0]}
                name="Días"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <Accordion
        type="single"
        collapsible
        className="bg-card rounded-xl border border-border px-5"
      >
        <AccordionItem value="t" className="border-0">
          <AccordionTrigger className="text-navy font-semibold">
            {tituloTabla}
          </AccordionTrigger>
          <AccordionContent>
            {esDia ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">
                      Excedente (kWh)
                    </TableHead>
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
                      <TableCell className="text-right tabular-nums">
                        {fmtN(d.excedente_kWh, 1)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtN(d.pico_kW, 1)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {d.h_inicio}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {d.h_fin}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {d.duracion_h}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtN(d.gen_PV_kWh, 1)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Periodo</TableHead>
                    <TableHead className="text-right">
                      Excedente (kWh)
                    </TableHead>
                    <TableHead className="text-right">Pico (kW)</TableHead>
                    <TableHead className="text-right">Gen PV (kWh)</TableHead>
                    <TableHead className="text-right">
                      Días con excedente
                    </TableHead>
                    <TableHead>Mejor día</TableHead>
                    <TableHead>Peor día</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {buckets.map((b) => (
                    <TableRow key={`${b.fechaInicio}-${b.fechaFin}`}>
                      <TableCell>
                        <div className="font-medium">{b.etiqueta}</div>
                        <div className="text-xs text-muted-foreground">
                          {b.fechaInicio} a {b.fechaFin}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtN(b.excedente_kWh, 1)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtN(b.pico_kW, 1)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtN(b.gen_PV_kWh, 1)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {b.dias_con_excedente} de {b.dias_totales}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {b.mejor_dia.fecha} · {fmtN(b.mejor_dia.excedente_kWh, 0)} kWh
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {b.peor_dia.fecha} · {fmtN(b.peor_dia.excedente_kWh, 0)} kWh
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
