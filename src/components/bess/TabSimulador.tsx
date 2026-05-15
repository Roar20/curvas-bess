import { useMemo, useState, useEffect } from "react";
import { CrudosData, ResumenData, SimResult } from "@/types/bess";
import { simularBESS, fmtN, fmtMXN } from "@/lib/bess-sim";
import { MetricCard } from "./MetricCard";
import { Slider } from "@/components/ui/slider";
import { RangeSlider } from "@/components/ui/range-slider";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  agregarDiasDetallePorGranularidad,
  agregarPorGranularidad,
  granularidadDefault,
  granularidadesDisponibles,
  ETIQUETA_GRAN,
  PLURAL_GRAN,
  ARTICULO_PLURAL_GRAN,
  SOC_LABEL,
  type BucketSimulador,
  type Bucket,
  type Granularidad,
} from "@/lib/agregaciones";

interface Props {
  data: ResumenData;
  crudos: CrudosData | null;
  P_kW: number;
  E_kWh: number;
  DOD: number;
  RTE: number;
  setP: (n: number) => void;
  setE: (n: number) => void;
  setDOD: (n: number) => void;
  setRTE: (n: number) => void;
}

type ChartRow = BucketSimulador & { x: string; gen: number; carga: number; descarga: number; perdido: number; soc: number };

type TooltipProps = {
  active?: boolean;
  payload?: { payload: ChartRow }[];
};

function ChartTooltip({
  active,
  payload,
  gran,
}: TooltipProps & { gran: Granularidad }) {
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
      {gran !== "dia" && (
        <div>
          Días incluidos:{" "}
          <span className="font-medium tabular-nums">{b.diasIncluidos}</span>
        </div>
      )}
      <div>
        PV bruta:{" "}
        <span className="font-medium tabular-nums">
          {fmtN(b.pv_bruta_kWh, 0)} kWh
        </span>
      </div>
      <div>
        Carga BESS:{" "}
        <span className="font-medium tabular-nums">
          {fmtN(b.carga_kWh, 0)} kWh
        </span>
      </div>
      <div>
        Descarga BESS:{" "}
        <span className="font-medium tabular-nums">
          {fmtN(b.descarga_kWh, 0)} kWh
        </span>
      </div>
      <div>
        SOC máximo:{" "}
        <span className="font-medium tabular-nums">
          {fmtN(b.soc_max_kWh, 0)} kWh
        </span>
      </div>
    </div>
  );
}

export function TabSimulador({
  data,
  crudos,
  P_kW,
  E_kWh,
  DOD,
  RTE,
  setP,
  setE,
  setDOD,
  setRTE,
}: Props) {
  const [computing, setComputing] = useState(false);
  const [sim, setSim] = useState<SimResult | null>(null);

  const dias = data.meta.dias_analizados;
  const disponibles = useMemo(() => granularidadesDisponibles(dias), [dias]);
  const [gran, setGran] = useState<Granularidad>(() => {
    const def = granularidadDefault(dias);
    return disponibles.includes(def)
      ? def
      : disponibles[disponibles.length - 1];
  });

  useEffect(() => {
    if (!crudos) return;
    setComputing(true);
    const t = setTimeout(() => {
      const r = simularBESS(crudos, P_kW, E_kWh, DOD / 100, RTE / 100);
      setSim(r);
      setComputing(false);
    }, 30);
    return () => clearTimeout(t);
  }, [crudos, P_kW, E_kWh, DOD, RTE]);

  const horas = P_kW > 0 ? E_kWh / P_kW : 0;

  const bucketsSim = useMemo<BucketSimulador[]>(() => {
    if (!sim) return [];
    return agregarDiasDetallePorGranularidad(sim.diario, gran);
  }, [sim, gran]);

  const bucketsExcedente = useMemo<Bucket[]>(
    () => agregarPorGranularidad(data.excedente_diario, gran),
    [data.excedente_diario, gran],
  );

  // Range slider: reset when bucket count changes
  const [rango, setRango] = useState<[number, number]>([0, 0]);
  useEffect(() => {
    setRango([0, Math.max(0, bucketsSim.length - 1)]);
  }, [bucketsSim.length]);

  const rangoVisible: [number, number] = useMemo(() => {
    if (bucketsSim.length === 0) return [0, 0];
    const lo = Math.max(0, Math.min(rango[0], bucketsSim.length - 1));
    const hi = Math.max(lo, Math.min(rango[1], bucketsSim.length - 1));
    return [lo, hi];
  }, [rango, bucketsSim.length]);

  const bucketsVisibles = useMemo(
    () => bucketsSim.slice(rangoVisible[0], rangoVisible[1] + 1),
    [bucketsSim, rangoVisible],
  );

  const bucketsExcedenteVisibles = useMemo(
    () => bucketsExcedente.slice(rangoVisible[0], rangoVisible[1] + 1),
    [bucketsExcedente, rangoVisible],
  );

  const chartData: ChartRow[] = useMemo(
    () =>
      bucketsVisibles.map((b) => ({
        ...b,
        x: b.etiqueta,
        gen: b.pv_bruta_kWh,
        carga: b.carga_kWh,
        descarga: b.descarga_kWh,
        perdido: b.perdido_kWh,
        soc: b.soc_max_kWh,
      })),
    [bucketsVisibles],
  );

  const totalGen = bucketsVisibles.reduce((s, b) => s + b.pv_bruta_kWh, 0);
  const totalCarga = bucketsVisibles.reduce((s, b) => s + b.carga_kWh, 0);
  const totalDesc = bucketsVisibles.reduce((s, b) => s + b.descarga_kWh, 0);
  const totalPerd = bucketsVisibles.reduce((s, b) => s + b.perdido_kWh, 0);

  // KPIs globales del simulador (independientes de la vista temporal)
  const PRECIO_MXN = 1011;
  const energiaExtraTotal = sim ? sim.descargado_kWh / 1000 : 0; // MWh
  const valorTotal = sim ? sim.descargado_kWh * (PRECIO_MXN / 1000) : 0;
  const factorMes = dias > 0 ? 30 / dias : 1;
  const valorMes = valorTotal * factorMes;
  const ciclos = sim ? sim.descargado_kWh / (E_kWh * (DOD / 100)) : 0;
  const ciclos_ano = dias > 0 ? ciclos * (365 / dias) : 0;
  const socPctNominal = sim ? (100 * sim.soc_max_kWh) / E_kWh : 0;

  // Slider visibility rules
  const mostrarSlider =
    bucketsSim.length > 1 &&
    (gran === "dia" ? bucketsSim.length > 30 : bucketsSim.length > 7);

  const fechaInicioVisible = bucketsVisibles[0]?.fechaInicio ?? "—";
  const fechaFinVisible =
    bucketsVisibles[bucketsVisibles.length - 1]?.fechaFin ?? "—";
  const etiquetaInicioVisible = bucketsVisibles[0]?.etiqueta ?? "—";
  const etiquetaFinVisible =
    bucketsVisibles[bucketsVisibles.length - 1]?.etiqueta ?? "—";

  const subtituloCard =
    bucketsVisibles.length > 0
      ? `${fechaInicioVisible} a ${fechaFinVisible} · ${bucketsVisibles.length} ${PLURAL_GRAN[gran]}`
      : "Sin datos";

  const tituloTabla = `Tabla completa de ${ARTICULO_PLURAL_GRAN[gran]} ${bucketsVisibles.length} ${PLURAL_GRAN[gran]}`;

  // Fechas individuales (días) que caen dentro del rango visible — para tabla en modo Día
  const diasVisibles = useMemo(() => {
    if (bucketsVisibles.length === 0) return [];
    const inicio = bucketsVisibles[0].fechaInicio;
    const fin = bucketsVisibles[bucketsVisibles.length - 1].fechaFin;
    return data.excedente_diario.filter(
      (d) => d.fecha >= inicio && d.fecha <= fin,
    );
  }, [bucketsVisibles, data.excedente_diario]);

  return (
    <div className="grid lg:grid-cols-[320px_1fr] gap-6">
      {/* Sidebar */}
      <aside
        className="bg-card rounded-xl border border-border p-5 space-y-6 h-fit lg:sticky lg:top-4"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <div>
          <h3 className="font-semibold text-navy">Configuración del BESS</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Mueve los sliders para recalcular en vivo
          </p>
        </div>

        <SliderRow
          label="Potencia AC"
          value={P_kW}
          unit="kW"
          min={100}
          max={700}
          step={25}
          onChange={setP}
        />
        <SliderRow
          label="Capacidad nominal"
          value={E_kWh}
          unit="kWh"
          min={200}
          max={3000}
          step={100}
          onChange={setE}
        />
        <SliderRow
          label="DOD"
          value={DOD}
          unit="%"
          min={80}
          max={100}
          step={1}
          onChange={setDOD}
        />
        <SliderRow
          label="RTE round-trip"
          value={RTE}
          unit="%"
          min={70}
          max={95}
          step={1}
          onChange={setRTE}
        />

        <div className="pt-4 border-t border-border space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Ratio P/E:</span>
            <span className="font-medium tabular-nums">
              {horas.toFixed(2)} h
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Capacidad útil:</span>
            <span className="font-medium tabular-nums">
              {fmtN(E_kWh * (DOD / 100))} kWh
            </span>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="space-y-6">
        <header>
          <h2 className="text-2xl md:text-3xl font-semibold text-navy">
            Simulador: BESS de {fmtN(P_kW)} kW / {fmtN(E_kWh)} kWh (
            {horas.toFixed(1)} h)
          </h2>
          <p className="text-muted-foreground text-sm mt-1 flex items-center gap-2">
            {computing && (
              <span className="inline-block h-2 w-2 rounded-full bg-sky animate-pulse" />
            )}
            Simulación cincominutal de {fmtN(crudos?.meta.registros ?? 0)}{" "}
            registros · DOD {DOD}% · RTE {RTE}%
          </p>
        </header>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="metric-card">
            <div className="metric-label">% Excedente capturado</div>
            <div className="metric-value">
              {sim ? sim.pct_capturado.toFixed(1) : "—"}%
            </div>
            <Progress value={sim?.pct_capturado ?? 0} className="mt-2 h-1.5" />
          </div>
          <MetricCard
            label="Energía descargada (total)"
            value={fmtN(energiaExtraTotal, 1)}
            unit="MWh"
            variant="success"
          />
          <MetricCard
            label="Energía perdida residual"
            value={fmtN(sim ? sim.perdido_kWh / 1000 : 0, 1)}
            unit="MWh"
            variant={sim && sim.perdido_kWh / 1000 > 5 ? "danger" : "default"}
          />
          <MetricCard
            label="Ciclos equivalentes / año"
            value={fmtN(ciclos_ano, 0)}
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            label="Valor mensual extra"
            value={fmtMXN(valorMes)}
            unit="MXN"
            hint={`@ $${PRECIO_MXN}/MWh`}
          />
          <MetricCard label="Valor anual lineal" value={fmtMXN(valorMes * 12)} unit="MXN" />
          <MetricCard
            label="SOC máximo del periodo"
            value={socPctNominal.toFixed(1)}
            unit="% nom."
          />
          <MetricCard
            label="Días saturado >90%"
            value={`${sim?.dias_saturado ?? 0} / ${dias}`}
          />
        </div>

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
                <h3 className="font-semibold text-navy">
                  Detalle del periodo
                </h3>
                <p className="text-xs text-muted-foreground">
                  {subtituloCard}
                </p>
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
                  {bucketsVisibles.length} de {bucketsSim.length}{" "}
                  {PLURAL_GRAN[gran]}
                </span>
              </div>
              <RangeSlider
                min={0}
                max={Math.max(0, bucketsSim.length - 1)}
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

          <div style={{ width: "100%", height: 380 }}>
            <ResponsiveContainer>
              <ComposedChart
                data={chartData}
                margin={{ top: 10, right: 30, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="x"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  interval="preserveStartEnd"
                />
                <YAxis
                  yAxisId="left"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="hsl(var(--soc))"
                  fontSize={12}
                  label={{
                    value: "SOC (kWh)",
                    angle: 90,
                    position: "insideRight",
                    fill: "hsl(var(--soc))",
                    fontSize: 11,
                  }}
                />
                <Tooltip content={<ChartTooltip gran={gran} />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar
                  yAxisId="left"
                  dataKey="gen"
                  name="PV bruta"
                  fill="hsl(var(--pv))"
                  radius={[3, 3, 0, 0]}
                />
                <Bar
                  yAxisId="left"
                  dataKey="carga"
                  name="Carga BESS"
                  fill="hsl(var(--charge))"
                  radius={[3, 3, 0, 0]}
                />
                <Bar
                  yAxisId="left"
                  dataKey="descarga"
                  name="Descarga BESS"
                  fill="hsl(var(--discharge))"
                  radius={[3, 3, 0, 0]}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="soc"
                  name={SOC_LABEL[gran]}
                  stroke="hsl(var(--soc))"
                  strokeWidth={2.5}
                  dot={bucketsVisibles.length <= 60}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MiniMetric
              label="Gen PV bruta"
              value={fmtN(totalGen, 0)}
              unit="kWh"
            />
            <MiniMetric
              label="Cargado"
              value={fmtN(totalCarga, 0)}
              unit="kWh"
            />
            <MiniMetric
              label="Descargado"
              value={fmtN(totalDesc, 0)}
              unit="kWh"
            />
            <MiniMetric
              label="Perdido"
              value={fmtN(totalPerd, 0)}
              unit="kWh"
              danger
            />
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
              {gran === "dia" ? (
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
                    {bucketsExcedenteVisibles.map((b) => (
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
    </div>
  );
}

function SliderRow({
  label,
  value,
  unit,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-baseline">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="text-sm tabular-nums font-semibold text-navy">
          {value.toLocaleString("es-MX")}{" "}
          <span className="text-xs text-muted-foreground">{unit}</span>
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(v[0])}
      />
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

function MiniMetric({
  label,
  value,
  unit,
  danger,
}: {
  label: string;
  value: string;
  unit: string;
  danger?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-secondary/40 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="flex items-baseline gap-1">
        <span
          className={`text-lg font-semibold tabular-nums ${danger ? "text-warning" : "text-navy"}`}
        >
          {value}
        </span>
        <span className="text-xs text-muted-foreground">{unit}</span>
      </div>
    </div>
  );
}
