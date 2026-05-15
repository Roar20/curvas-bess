import { useMemo, useState, useEffect } from "react";
import { CrudosData, ResumenData, SimResult, DiaDetalle } from "@/types/bess";
import { simularBESS, fmtN, fmtMXN } from "@/lib/bess-sim";
import { MetricCard } from "./MetricCard";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

type Vista = "dia" | "semana" | "mes";

function sumArr(a: number[]) {
  let s = 0;
  for (const v of a) s += v;
  return s;
}
function maxArr(a: number[]) {
  let m = -Infinity;
  for (const v of a) if (v > m) m = v;
  return m === -Infinity ? 0 : m;
}
function fechaCorta(fecha: string) {
  // fecha = "YYYY-MM-DD"
  return fecha.slice(5);
}

export function TabSimulador({ data, crudos, P_kW, E_kWh, DOD, RTE, setP, setE, setDOD, setRTE }: Props) {
  const [computing, setComputing] = useState(false);
  const [sim, setSim] = useState<SimResult | null>(null);
  const fechasDisponibles = data.excedente_diario.map((d) => d.fecha);
  const [dia, setDia] = useState<string>(
    fechasDisponibles[Math.floor(fechasDisponibles.length / 2)] ?? fechasDisponibles[0] ?? "",
  );
  const [vista, setVista] = useState<Vista>("dia");

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

  const horas = E_kWh / P_kW;

  const diaData: DiaDetalle | null = sim?.diario[dia] ?? null;

  // Días que componen la vista actual.
  const fechasVista = useMemo<string[]>(() => {
    if (!sim) return [];
    const todas = fechasDisponibles.filter((f) => sim.diario[f]);
    if (vista === "mes") return todas;
    if (vista === "semana") {
      const idx = todas.indexOf(dia);
      if (idx < 0) return todas.slice(0, 7);
      const start = Math.max(0, Math.min(idx - 3, todas.length - 7));
      return todas.slice(start, start + 7);
    }
    return dia ? [dia] : [];
  }, [sim, fechasDisponibles, vista, dia]);

  const chartData = useMemo(() => {
    if (!sim) return [];
    if (vista === "dia") {
      if (!diaData) return [];
      return diaData.horas.map((h, i) => ({
        x: `${h}h`,
        gen: diaData.gen[i],
        carga: diaData.carga[i],
        descarga: diaData.descarga[i],
        perdido: diaData.perdido[i],
        soc: diaData.soc[i],
      }));
    }
    return fechasVista.map((f) => {
      const d = sim.diario[f];
      return {
        x: fechaCorta(f),
        gen: sumArr(d.gen),
        carga: sumArr(d.carga),
        descarga: sumArr(d.descarga),
        perdido: sumArr(d.perdido),
        soc: maxArr(d.soc),
      };
    });
  }, [sim, vista, diaData, fechasVista]);

  const periodoLabel =
    vista === "dia"
      ? dia
      : vista === "semana"
        ? `${fechasVista[0] ?? ""} a ${fechasVista[fechasVista.length - 1] ?? ""}`
        : `${fechasVista.length} días`;

  const PRECIO_MXN = 1011;
  const factorMes = sim ? 31 / 31 : 1; // ya es mensual
  const energiaExtra = sim ? sim.descargado_kWh / 1000 : 0; // MWh/mes
  const valorMes = sim ? sim.descargado_kWh * (PRECIO_MXN / 1000) : 0;
  const ciclos_mes = sim ? sim.descargado_kWh / (E_kWh * (DOD / 100)) : 0;
  const ciclos_ano = ciclos_mes * 12;
  const vida = ciclos_ano > 0 ? Math.min(20, 6000 / ciclos_ano) : 0;
  const socPctNominal = sim ? (100 * sim.soc_max_kWh) / E_kWh : 0;

  const totalGen = chartData.reduce((s, r) => s + r.gen, 0);
  const totalCarga = chartData.reduce((s, r) => s + r.carga, 0);
  const totalDesc = chartData.reduce((s, r) => s + r.descarga, 0);
  const totalPerd = chartData.reduce((s, r) => s + r.perdido, 0);

  return (
    <div className="grid lg:grid-cols-[320px_1fr] gap-6">
      {/* Sidebar */}
      <aside
        className="bg-card rounded-xl border border-border p-5 space-y-6 h-fit lg:sticky lg:top-4"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <div>
          <h3 className="font-semibold text-navy">Configuración del BESS</h3>
          <p className="text-xs text-muted-foreground mt-1">Mueve los sliders para recalcular en vivo</p>
        </div>

        <SliderRow label="Potencia AC" value={P_kW} unit="kW" min={100} max={700} step={25} onChange={setP} />
        <SliderRow label="Capacidad nominal" value={E_kWh} unit="kWh" min={200} max={3000} step={100} onChange={setE} />
        <SliderRow label="DOD" value={DOD} unit="%" min={80} max={100} step={1} onChange={setDOD} />
        <SliderRow label="RTE round-trip" value={RTE} unit="%" min={70} max={95} step={1} onChange={setRTE} />

        <div className="pt-4 border-t border-border space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Ratio P/E:</span>
            <span className="font-medium tabular-nums">{horas.toFixed(2)} h</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Capacidad útil:</span>
            <span className="font-medium tabular-nums">{fmtN(E_kWh * (DOD / 100))} kWh</span>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="space-y-6">
        <header>
          <h2 className="text-2xl md:text-3xl font-semibold text-navy">
            Simulador: BESS de {fmtN(P_kW)} kW / {fmtN(E_kWh)} kWh ({horas.toFixed(1)} h)
          </h2>
          <p className="text-muted-foreground text-sm mt-1 flex items-center gap-2">
            {computing && <span className="inline-block h-2 w-2 rounded-full bg-sky animate-pulse" />}
            Simulación cincominutal de {fmtN(crudos?.meta.registros ?? 0)} registros · DOD {DOD}% · RTE {RTE}%
          </p>
        </header>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="metric-card">
            <div className="metric-label">% Excedente capturado</div>
            <div className="metric-value">{sim ? sim.pct_capturado.toFixed(1) : "—"}%</div>
            <Progress value={sim?.pct_capturado ?? 0} className="mt-2 h-1.5" />
          </div>
          <MetricCard label="Energía extra al POI / mes" value={fmtN(energiaExtra, 1)} unit="MWh" variant="success" />
          <MetricCard
            label="Energía perdida residual"
            value={fmtN(sim ? sim.perdido_kWh / 1000 : 0, 1)}
            unit="MWh"
            variant={sim && sim.perdido_kWh / 1000 > 5 ? "danger" : "default"}
          />
          <MetricCard label="Ciclos equivalentes / año" value={fmtN(ciclos_ano, 0)} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard label="Valor mensual extra" value={fmtMXN(valorMes)} unit="MXN" hint={`@ $${PRECIO_MXN}/MWh`} />
          <MetricCard label="Valor anual lineal" value={fmtMXN(valorMes * 12)} unit="MXN" />
          <MetricCard label="SOC máximo del mes" value={socPctNominal.toFixed(1)} unit="% nom." />
          <MetricCard label="Días saturado >90%" value={`${sim?.dias_saturado ?? 0} / 31`} />
        </div>

        <div
          className="bg-card rounded-xl border border-border p-5 space-y-4"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-navy">Detalle del periodo</h3>
              <p className="text-xs text-muted-foreground">{periodoLabel}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex rounded-lg border border-border bg-secondary/40 p-1">
                {(["dia", "semana", "mes"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setVista(v)}
                    className={`px-3 py-1 text-sm rounded-md transition-colors ${
                      vista === v
                        ? "bg-navy text-white"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {v === "dia" ? "Día" : v === "semana" ? "Semana" : "Mes"}
                  </button>
                ))}
              </div>
              {vista !== "mes" && (
                <Select value={dia} onValueChange={setDia}>
                  <SelectTrigger className="w-[220px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {data.excedente_diario.map((d) => (
                      <SelectItem key={d.fecha} value={d.fecha}>
                        {d.fecha} — {fmtN(d.excedente_kWh, 0)} kWh
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <div style={{ width: "100%", height: 380 }}>
            <ResponsiveContainer>
              <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="x"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="hsl(var(--soc))"
                  fontSize={12}
                  label={{ value: "SOC (kWh)", angle: 90, position: "insideRight", fill: "hsl(var(--soc))", fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelFormatter={(x) =>
                    vista === "dia" ? `Hora ${String(x).replace("h", "")}:00` : `Día ${x}`
                  }
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar yAxisId="left" dataKey="gen" name="PV bruta" fill="hsl(var(--pv))" radius={[3, 3, 0, 0]} />
                <Bar yAxisId="left" dataKey="carga" name="Carga BESS" fill="hsl(var(--charge))" radius={[3, 3, 0, 0]} />
                <Bar yAxisId="left" dataKey="descarga" name="Descarga BESS" fill="hsl(var(--discharge))" radius={[3, 3, 0, 0]} />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="soc"
                  name={vista === "dia" ? "SOC" : "SOC máx diario"}
                  stroke="hsl(var(--soc))"
                  strokeWidth={2.5}
                  dot={vista !== "dia"}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MiniMetric label="Gen PV bruta" value={fmtN(totalGen, 0)} unit="kWh" />
            <MiniMetric label="Cargado" value={fmtN(totalCarga, 0)} unit="kWh" />
            <MiniMetric label="Descargado" value={fmtN(totalDesc, 0)} unit="kWh" />
            <MiniMetric label="Perdido" value={fmtN(totalPerd, 0)} unit="kWh" danger />
          </div>
        </div>
      </div>
    </div>
  );
}

function SliderRow({
  label, value, unit, min, max, step, onChange,
}: { label: string; value: number; unit: string; min: number; max: number; step: number; onChange: (n: number) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-baseline">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="text-sm tabular-nums font-semibold text-navy">
          {value.toLocaleString("es-MX")} <span className="text-xs text-muted-foreground">{unit}</span>
        </span>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={(v) => onChange(v[0])} />
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

function MiniMetric({ label, value, unit, danger }: { label: string; value: string; unit: string; danger?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/40 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className={`text-lg font-semibold tabular-nums ${danger ? "text-warning" : "text-navy"}`}>{value}</span>
        <span className="text-xs text-muted-foreground">{unit}</span>
      </div>
    </div>
  );
}