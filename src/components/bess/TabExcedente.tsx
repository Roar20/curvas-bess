import { useEffect, useMemo, useState } from "react";
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
import { RangeSlider } from "@/components/ui/range-slider";

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

function percentil(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.max(
    0,
    Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1))),
  );
  return sorted[idx];
}

function promedio(arr: number[]): number {
  if (arr.length === 0) return 0;
  let s = 0;
  for (const v of arr) s += v;
  return s / arr.length;
}

function maxArr(arr: number[]): number {
  let m = -Infinity;
  for (const v of arr) if (v > m) m = v;
  return m === -Infinity ? 0 : m;
}

export function TabExcedente({ data }: { data: ResumenData }) {
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

  const [rango, setRango] = useState<[number, number]>([0, 0]);
  useEffect(() => {
    setRango([0, Math.max(0, buckets.length - 1)]);
  }, [buckets.length]);

  const rangoVisible: [number, number] = useMemo(() => {
    if (buckets.length === 0) return [0, 0];
    const lo = Math.max(0, Math.min(rango[0], buckets.length - 1));
    const hi = Math.max(lo, Math.min(rango[1], buckets.length - 1));
    return [lo, hi];
  }, [rango, buckets.length]);

  const bucketsVisibles = useMemo(
    () => buckets.slice(rangoVisible[0], rangoVisible[1] + 1),
    [buckets, rangoVisible],
  );

  const fechaInicioVisible = bucketsVisibles[0]?.fechaInicio ?? "—";
  const fechaFinVisible =
    bucketsVisibles[bucketsVisibles.length - 1]?.fechaFin ?? "—";
  const etiquetaInicioVisible = bucketsVisibles[0]?.etiqueta ?? "—";
  const etiquetaFinVisible =
    bucketsVisibles[bucketsVisibles.length - 1]?.etiqueta ?? "—";

  const diasVisibles = useMemo(() => {
    if (bucketsVisibles.length === 0) return [];
    return data.excedente_diario.filter(
      (d) =>
        d.fecha >= fechaInicioVisible && d.fecha <= fechaFinVisible,
    );
  }, [data.excedente_diario, bucketsVisibles, fechaInicioVisible, fechaFinVisible]);

  const excedentesVisibles = useMemo(
    () => diasVisibles.map((d) => d.excedente_kWh),
    [diasVisibles],
  );

  const stats = useMemo(
    () => ({
      promedio: promedio(excedentesVisibles),
      mediana: percentil(excedentesVisibles, 0.5),
      p90: percentil(excedentesVisibles, 0.9),
      maximo: maxArr(excedentesVisibles),
    }),
    [excedentesVisibles],
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
  const subtituloCard =
    bucketsVisibles.length > 0
      ? `${fechaInicioVisible} a ${fechaFinVisible} · ${bucketsVisibles.length} ${PLURAL_GRAN[gran]}`
      : "Sin datos";
  const tituloTabla = `Tabla completa de ${ARTICULO_PLURAL_GRAN[gran]} ${bucketsVisibles.length} ${PLURAL_GRAN[gran]}`;

  const mostrarSlider =
    buckets.length > 1 &&
    (gran === "dia" ? buckets.length > 30 : buckets.length > 7);

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
        className="bg-card rounded-xl border border-border p-5 space-y-4"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <Tabs
          value={gran}
          onValueChange={(v) => setGran(v as Granularidad)}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-navy">{tituloCard}</h3>
              <p className="text-xs text-muted-foreground">{subtituloCard}</p>
            </div>
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

        {mostrarSlider && (
          <div className="space-y-2 pt-2">
            <div className="flex justify-between items-baseline text-xs">
              <span className="text-muted-foreground">
                Rango:{" "}
                <span className="font-medium text-foreground">
                  {etiquetaInicioVisible}
                </span>{" "}
                →{" "}
                <span className="font-medium text-foreground">
                  {etiquetaFinVisible}
                </span>
              </span>
              <span className="text-muted-foreground tabular-nums">
                {bucketsVisibles.length} de {buckets.length}{" "}
                {PLURAL_GRAN[gran]}
              </span>
            </div>
            <RangeSlider
              min={0}
              max={Math.max(0, buckets.length - 1)}
              step={1}
              value={[rangoVisible[0], rangoVisible[1]]}
              onValueChange={(v) =>
                setRango([v[0], v[1]] as [number, number])
              }
            />
            <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
              <span>{fechaInicioVisible}</span>
              <span>{fechaFinVisible}</span>
            </div>
          </div>
        )}

        <div style={{ width: "100%", height: 400 }}>
          <ResponsiveContainer>
            <BarChart
              data={bucketsVisibles}
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
                {bucketsVisibles.map((b) => (
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
          value={fmtN(stats.promedio)}
          unit="kWh"
        />
        <MetricCard
          label="Mediana"
          value={fmtN(stats.mediana)}
          unit="kWh"
        />
        <MetricCard label="P90" value={fmtN(stats.p90)} unit="kWh" />
        <MetricCard
          label="Día crítico (máx)"
          value={fmtN(stats.maximo)}
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
                  {diasVisibles.map((d) => (
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
                    <TableHead>Fechas</TableHead>
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
                  {bucketsVisibles.map((b) => (
                    <TableRow key={`${b.fechaInicio}-${b.fechaFin}`}>
                      <TableCell className="font-medium">
                        {b.etiqueta}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground tabular-nums">
                        {b.fechaInicio} a {b.fechaFin}
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
                        {b.mejor_dia.fecha} ·{" "}
                        {fmtN(b.mejor_dia.excedente_kWh, 0)} kWh
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {b.peor_dia.fecha} ·{" "}
                        {fmtN(b.peor_dia.excedente_kWh, 0)} kWh
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
