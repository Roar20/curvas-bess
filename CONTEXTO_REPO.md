# CONTEXTO_REPO.md — Roar20/curvas-bess

Dossier técnico del repositorio. Generado para que un asistente externo redacte un prompt de desarrollo. Ningún archivo del repo fue modificado al producir esto.

App: Simulador de dimensionamiento BESS (Battery Energy Storage System) sobre plantas PV. Stack: React 18 + TypeScript + Vite + Tailwind + shadcn/ui + recharts + xlsx. Desplegado en Vercel (`vercel.json` apunta framework `vite`, `outputDirectory: dist`, SPA rewrite).

Branch principal: `main`. Última commit referencia en este dossier: `d7b23e0` (PR #11, "feat(despacho): pulido cosmético").

---

## 1. Estructura de carpetas (src/, hasta 2 niveles, sin node_modules ni components/ui)

```
src/
├── App.css
├── App.tsx
├── components/
│   ├── NavLink.tsx
│   └── bess/                            ← features dominio BESS
│       ├── Callout.tsx
│       ├── DespachoKPIs.tsx
│       ├── DespachoNarrativa.tsx
│       ├── DespachoTablaTecnica.tsx
│       ├── HeatmapDiaHora.tsx
│       ├── MetricCard.tsx
│       ├── TabDecision.tsx
│       ├── TabDespacho.tsx
│       ├── TabDiagnostico.tsx
│       ├── TabExcedente.tsx
│       ├── TabPareto.tsx
│       ├── TabPerfil.tsx
│       ├── TabResumen.tsx
│       └── TabSimulador.tsx
├── hooks/
│   ├── use-mobile.tsx                   ← genérico (shadcn boilerplate)
│   └── use-toast.ts                     ← genérico (shadcn boilerplate)
├── index.css
├── lib/
│   ├── agregaciones.ts                  ← buckets por granularidad temporal
│   ├── analizar.ts                      ← orquestador top-level
│   ├── bess-sim.ts                      ← motor de simulación BESS 5-min
│   ├── cinco-min.ts                     ← reconstrucción cinco-minutal + ResumenData builder
│   ├── data-loader.ts                   ← parsing del Excel con xlsx
│   ├── diagnostico.ts                   ← clasificación + escenarios sugeridos
│   ├── recurso.ts                       ← caracterización del recurso PV real
│   ├── storage.ts                       ← wrapper tipado de localStorage
│   └── utils.ts                         ← cn() helper (shadcn)
├── main.tsx
├── pages/
│   ├── Index.tsx                        ← /reporte (reporte con 8 tabs)
│   ├── NotFound.tsx
│   └── Onboarding.tsx                   ← / (sube Excel + config cliente)
├── test/
│   ├── colab-parity.test.ts
│   ├── example.test.ts
│   └── setup.ts
├── types/
│   └── bess.ts                          ← único archivo de tipos del dominio
└── vite-env.d.ts
```

**Aclaración explícita:** no existe un `src/components/Despacho.tsx`. Despacho vive en `src/components/bess/TabDespacho.tsx` con tres subcomponentes hermanos (`DespachoNarrativa.tsx`, `DespachoKPIs.tsx`, `DespachoTablaTecnica.tsx`). El prefijo `Tab*` se usa para los siete componentes que se cargan en `<TabsContent>` desde `Index.tsx`.

---

## 2. Tipos centrales

`src/types/` solo contiene `bess.ts`. Contenido completo:

```ts
// src/types/bess.ts

// Tipos originales de la app (no se modifican estructuralmente).
// Se agregan campos opcionales para la Parte 1.

export interface ResumenData {
  meta: {
    sitio: string;
    ubicacion: string;
    periodo_analizado: string;
    resolucion_minutos: number;
    registros_totales: number;
    dias_analizados: number;
    fecha_inicio: string;
    fecha_fin: string;
  };
  recurso_pv: {
    energia_pv_bruta_MWh: number;
    energia_al_poi_MWh: number;
    curtailment_MWh: number;
    curtailment_pct: number;
    pico_pv_kW: number;
    POI_kW: number;
    cap_pv_total_kW: number;
    factor_planta_pct: number;
    horas_sol_diarias_promedio: number;
  };
  estadisticos_excedente: {
    pico_kW: number;
    p99_kW: number;
    p95_kW: number;
    p90_kW: number;
    promedio_kW_cuando_hay: number;
    diario_promedio_kWh: number;
    diario_mediana_kWh: number;
    diario_p90_kWh: number;
    diario_max_kWh: number;
    diario_min_kWh: number;
    duracion_promedio_h: number;
    h_inicio_promedio: number;
    h_fin_promedio: number;
  };
  excedente_diario: Array<{
    fecha: string;
    dia: number;
    excedente_kWh: number;
    pico_kW: number;
    h_inicio: number;
    h_fin: number;
    duracion_h: number;
    gen_PV_kWh: number;
  }>;
  perfil_horario: Array<{
    hora: number;
    gen_kW_avg: number;
    gen_kW_max: number;
    excedente_kW_avg: number;
    excedente_kW_max: number;
  }>;
  simulaciones: {
    [key: string]: SimulacionPre | DiasDetalle;
    dias_detalle: DiasDetalle;
  };
  pareto: Array<{
    P_kW: number;
    E_kWh: number;
    pct_capturado: number;
    cargado_kWh: number;
    perdido_kWh: number;
  }>;
  recomendacion: {
    P_kW: number;
    E_kWh: number;
    horas: number;
    tecnologia: string;
    DOD_pct: number;
    RTE_pct: number;
  };
  /** Resultados de Parte 1 (caracterización del recurso REAL sin escalar) */
  parte1?: {
    recurso_real: unknown;
    clipping_real: unknown;
    variabilidad: unknown;
    diagnostico: unknown;
    escenarios_sugeridos: unknown;
    perfil_horario_real: unknown;
  };
}

export interface SimulacionPre {
  nombre: string;
  P_kW: number;
  E_kWh: number;
  horas: number;
  cargado_kWh: number;
  descargado_kWh: number;
  perdido_kWh: number;
  pct_capturado: number;
  soc_max_kWh: number;
  utilizacion_pct: number;
  dias_saturado: number;
  h_carga_promedio: number;
  h_desc_promedio: number;
  ciclos_mes: number;
  ciclos_ano: number;
  vida_util_anos: number;
  energia_extra_MWh_mes: number;
  valor_extra_MXN_mes: number;
}

export interface DiaDetalle {
  horas: number[];
  gen: number[];
  excedente: number[];
  carga: number[];
  descarga: number[];
  soc: number[];
  perdido: number[];
}
export type DiasDetalle = Record<string, DiaDetalle>;

export interface CrudosData {
  meta: { columnas: string[]; resolucion_horas: number; registros: number };
  data: Array<[string, number, number]>;
}

export interface SimResult {
  cargado_kWh: number;
  descargado_kWh: number;
  perdido_kWh: number;
  pct_capturado: number;
  soc_max_kWh: number;
  pct_capturado_pre?: number;
  diario: Record<string, DiaDetalle>;
  dias_saturado: number;
}
```

**Notas estructurales:**
- `ResumenData.simulaciones` es un mapa heterogéneo: las llaves `subdimensionada / conservadora / recomendada / sobredimensionada` apuntan a `SimulacionPre`; la llave reservada `dias_detalle` apunta a `DiasDetalle` (per-día per-hora). Los componentes filtran por type-guard `(v): v is SimulacionPre => "P_kW" in v` cuando iteran.
- Tipos auxiliares del dominio (`RecursoReal`, `ClippingReal`, `Variabilidad`, `Diagnostico`, `Escenario`, `ConfigCliente`, `PropuestaConsultor`, `EstadoAnalisis`, `ParteUno`) viven en los archivos `src/lib/*.ts` que los producen, no en `types/`.

---

## 3. Componente representativo: Despacho

Despacho es la pestaña "cliente-friendly" más reciente. Tiene un orquestador + 3 subcomponentes.

### 3.1 `src/components/bess/TabDespacho.tsx` (orquestador)

```tsx
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
    hora: h, gen: 0, excedente: 0, carga: 0, descarga: 0, soc: 0, perdido: 0,
  }));
  if (fechas.length === 0) return filas;
  for (const f of fechas) {
    const d = diario[f];
    if (!d) continue;
    for (let h = 0; h < 24; h++) {
      filas[h].gen       += d.gen[h]       ?? 0;
      filas[h].excedente += d.excedente[h] ?? 0;
      filas[h].carga     += d.carga[h]     ?? 0;
      filas[h].descarga  += d.descarga[h]  ?? 0;
      filas[h].soc       += d.soc[h]       ?? 0;
      filas[h].perdido   += d.perdido[h]   ?? 0;
    }
  }
  const n = fechas.length;
  for (let h = 0; h < 24; h++) {
    filas[h].gen /= n; filas[h].excedente /= n; filas[h].carga /= n;
    filas[h].descarga /= n; filas[h].soc /= n; filas[h].perdido /= n;
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
    <div className="bg-card border border-border rounded-md p-2 text-xs space-y-1"
         style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="font-semibold text-navy">Hora {label}:00</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-sm" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="tabular-nums font-medium">
            {new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 }).format(p.value)} kWh
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
        ? calcularPromediosHorarios(data.simulaciones.dias_detalle as DiasDetalle)
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
          Una vista pensada para el cliente: dónde se almacena la energía y cuándo se entrega de vuelta.
        </p>
      </header>

      <DespachoNarrativa data={data} />

      <div className="bg-card rounded-xl border border-border p-5 space-y-3"
           style={{ boxShadow: "var(--shadow-card)" }}>
        <div>
          <h3 className="text-lg font-semibold text-navy">Despacho diario promedio</h3>
          <p className="text-xs text-muted-foreground">
            Generación solar y operación de la batería hora por hora.
          </p>
        </div>

        <div style={{ width: "100%", height: 380 }}>
          <ResponsiveContainer>
            <ComposedChart data={filas} margin={{ top: 30, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="hora" stroke="hsl(var(--muted-foreground))" fontSize={12}
                     tickFormatter={(h) => `${h}h`} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12}
                     label={{ value: "kW", angle: -90, position: "insideLeft",
                              fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />

              <ReferenceArea x1={HORA_PUNTA_INI} x2={HORA_PUNTA_FIN}
                             fill="hsl(var(--soc))" fillOpacity={0.1}
                             label={{ value: "Hora punta CFE", position: "insideTop",
                                      fill: "hsl(var(--soc))", fontSize: 11 }} />

              <Area type="monotone" dataKey="carga" name="Batería cargando"
                    stroke="hsl(var(--charge))" fill="hsl(var(--charge))"
                    fillOpacity={0.5} strokeWidth={2} />
              <Area type="monotone" dataKey="descarga" name="Batería entregando energía"
                    stroke="hsl(var(--soc))" fill="hsl(var(--soc))"
                    fillOpacity={0.55} strokeWidth={2} />
              <Line type="monotone" dataKey="gen" name="Generación solar"
                    stroke="hsl(var(--pv))" strokeWidth={2.5} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="rounded-md border border-border bg-secondary/40 p-3">
            <span className="font-medium text-foreground">Aquí se almacena el sobrante.</span>{" "}
            <span className="text-muted-foreground">
              Durante el día, cuando la planta solar genera más de lo que la red puede recibir.
            </span>
          </div>
          <div className="rounded-md border border-border bg-secondary/40 p-3">
            <span className="font-medium text-foreground">Aquí se entrega al cliente final.</span>{" "}
            <span className="text-muted-foreground">
              En la tarde-noche, dentro de la hora punta de CFE, donde la energía vale más.
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3 px-4 py-2 bg-muted/40 border border-border rounded-md">
        <p className="text-xs text-muted-foreground">
          <strong className="text-foreground">Nota técnica:</strong> el área verde (carga) representa más
          energía total que el área azul (descarga), aunque visualmente los picos parezcan al revés. Esto
          es porque la batería entrega en menos horas pero a mayor potencia. La descarga es ~85% de la
          carga por la eficiencia round-trip de la batería LFP.
        </p>
      </div>

      <DespachoKPIs data={data} />

      <DespachoTablaTecnica filas={filas} />
    </div>
  );
}
```

### 3.2 `src/components/bess/DespachoNarrativa.tsx`

```tsx
import type { ResumenData } from "@/types/bess";

interface Props {
  data: ResumenData;
}

export function DespachoNarrativa({ data }: Props) {
  const e = data.estadisticos_excedente;
  const horas = Math.round(e.duracion_promedio_h);
  const horaInicio = Math.round(e.h_inicio_promedio);
  const horaFin = Math.round(e.h_fin_promedio);
  const sinExcedente = e.duracion_promedio_h <= 0.5;

  return (
    <div className="bg-card rounded-xl border border-border p-6 leading-relaxed text-base text-foreground">
      {sinExcedente ? (
        <>
          La planta no presenta excedente significativo en el periodo analizado. La batería
          tendría poco material que almacenar y su beneficio económico es marginal en estas
          condiciones.
        </>
      ) : (
        <>
          Durante <strong>{horas} horas del día</strong> ({horaInicio}h–{horaFin}h), tu
          planta genera más energía de la que puede inyectar a la red. La batería propuesta
          captura ese sobrante y lo entrega cuando la energía vale más, entre las
          <strong> 18h y 22h</strong>.
        </>
      )}
    </div>
  );
}
```

### 3.3 `src/components/bess/DespachoKPIs.tsx`

```tsx
import type { ResumenData, SimulacionPre } from "@/types/bess";
import { fmtN, fmtMXN } from "@/lib/bess-sim";

function isSimulacionPre(v: unknown): v is SimulacionPre {
  return (
    typeof v === "object" &&
    v !== null &&
    "P_kW" in v &&
    typeof (v as { P_kW: unknown }).P_kW === "number"
  );
}

function Card({ titulo, valor, unidad, unidadHint, subtexto }: {
  titulo: string; valor: string; unidad?: string; unidadHint?: string; subtexto: string;
}) {
  return (
    <div className="bg-card rounded-xl border border-border p-6 space-y-2"
         style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="text-sm font-medium text-muted-foreground">{titulo}</div>
      <div className="flex items-baseline gap-2 flex-wrap">
        <div className="text-3xl font-semibold text-navy tabular-nums">{valor}</div>
        {unidad && <div className="text-sm text-muted-foreground">{unidad}</div>}
        {unidadHint && <div className="text-xs text-muted-foreground">· {unidadHint}</div>}
      </div>
      <div className="text-xs text-muted-foreground leading-relaxed">{subtexto}</div>
    </div>
  );
}

function calificadorCiclos(ciclos: number): string {
  if (ciclos < 200) return "uso conservador de la batería";
  if (ciclos < 365) return "uso moderado";
  return "uso intensivo (>1 ciclo/día promedio)";
}

export function DespachoKPIs({ data }: { data: ResumenData }) {
  const reco = data.simulaciones.recomendada;
  if (!isSimulacionPre(reco)) {
    return (
      <div className="text-sm text-muted-foreground">
        No hay datos de simulación recomendada.
      </div>
    );
  }

  const dias = data.meta.dias_analizados || 1;
  const energiaPorDia = reco.descargado_kWh / dias;
  // valor_extra_MXN_mes en cinco-min.ts es realmente el valor del periodo
  // analizado (descargado_kWh × precioMxnMwh / 1000), no estrictamente mensual.
  const valorAnual = reco.valor_extra_MXN_mes * (365 / dias);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card titulo="Energía adicional aprovechada"
            valor={fmtN(energiaPorDia, 0)} unidad="kWh por día"
            subtexto="Energía que sin la batería se perdería o se vendería barato." />
      <Card titulo="Valor anual capturado"
            valor={fmtMXN(valorAnual)} unidad="MXN"
            subtexto="Ingresos adicionales que el sistema genera al año." />
      <Card titulo="Ciclos al año"
            valor={fmtN(reco.ciclos_ano, 0)} unidad="ciclos"
            unidadHint={calificadorCiclos(reco.ciclos_ano)}
            subtexto="Cuántas veces la batería se carga y descarga al año. Una batería LFP típica soporta 6 000 ciclos antes de degradarse." />
    </div>
  );
}
```

### 3.4 `src/components/bess/DespachoTablaTecnica.tsx`

```tsx
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtN } from "@/lib/bess-sim";

export type FilaHora = {
  hora: number;
  gen: number;
  excedente: number;
  carga: number;
  descarga: number;
  soc: number;
  perdido: number;
};

export function DespachoTablaTecnica({ filas }: { filas: FilaHora[] }) {
  return (
    <Accordion type="single" collapsible
               className="bg-card rounded-xl border border-border px-5">
      <AccordionItem value="t" className="border-0">
        <AccordionTrigger className="text-navy font-semibold">
          Ver detalles técnicos del despacho
        </AccordionTrigger>
        <AccordionContent>
          <p className="text-xs text-muted-foreground mb-3">
            Promedio horario sobre el periodo analizado. Valores en kWh (energía durante esa
            hora) y SoC en kWh (estado de carga al cierre de la hora).
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hora</TableHead>
                <TableHead className="text-right">PV bruta (kWh)</TableHead>
                <TableHead className="text-right">Excedente (kWh)</TableHead>
                <TableHead className="text-right">Carga BESS (kWh)</TableHead>
                <TableHead className="text-right">Descarga BESS (kWh)</TableHead>
                <TableHead className="text-right">SoC (kWh)</TableHead>
                <TableHead className="text-right">Perdido (kWh)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((f) => (
                <TableRow key={f.hora}>
                  <TableCell className="font-medium tabular-nums">
                    {String(f.hora).padStart(2, "0")}:00
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{fmtN(f.gen, 1)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtN(f.excedente, 1)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtN(f.carga, 1)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtN(f.descarga, 1)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtN(f.soc, 1)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtN(f.perdido, 1)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
```

---

## 4. Componente representativo: Diagnóstico

`src/components/bess/TabDiagnostico.tsx`:

```tsx
import type { ResumenData } from "@/types/bess";
import { MetricCard } from "./MetricCard";
import { Callout } from "./Callout";
import { fmtN } from "@/lib/bess-sim";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface RecursoReal {
  energia_total_mwh: number;
  pico_kw: number;
  factor_planta_pct: number;
  factor_capacidad_pct: number;
  horas_sol_equiv_diaria: number;
  headroom_al_poi_pct: number;
  pico_vs_poi_pct: number;
  dias_analizados: number;
}

interface ClippingReal {
  horas_en_clipping: number;
  horas_con_generacion: number;
  pct_horas_clipping: number;
  dias_con_clipping: number;
  dias_totales: number;
  hay_clipping_real: boolean;
}

interface Variabilidad {
  dia_mejor_fecha: string;
  dia_mejor_mwh: number;
  dia_peor_fecha: string;
  dia_peor_mwh: number;
  promedio_mwh: number;
  mediana_mwh: number;
  p10_mwh: number;
  p90_mwh: number;
  dias_anomalos: string[];
}

interface Diagnostico {
  tipo_principal: string;
  sugerencia_arquitectura: "A" | "B" | "B'" | "C";
  sugerencia_texto: string;
  justificacion: string[];
}

interface Escenario {
  nivel: string;
  pv_adicional_kw: number;
  cap_pv_total_kw: number;
  factor_pv_poi: number;
  bess_p_kw: number;
  bess_e_kwh: number;
  bess_duracion_h: number;
  excedente_estimado: {
    pico_kw: number; p75_diario_kwh: number; max_diario_kwh: number;
  } | null;
}

interface ParteUno {
  recurso_real: RecursoReal;
  clipping_real: ClippingReal;
  variabilidad: Variabilidad;
  diagnostico: Diagnostico;
  escenarios_sugeridos: {
    conservador: Escenario; balanceado: Escenario; agresivo: Escenario;
  };
}

const ARQUITECTURA_LABELS: Record<string, { titulo: string; color: string }> = {
  A:    { titulo: "Solo BESS",                                color: "bg-warning/10 border-warning/30" },
  B:    { titulo: "PV adicional + BESS",                      color: "bg-sky/10 border-sky/30" },
  "B'": { titulo: "PV adicional + BESS con desplazamiento",   color: "bg-sky/15 border-sky/40" },
  C:    { titulo: "No recomendar inversión",                  color: "bg-muted border-border" },
};

export function TabDiagnostico({ data }: { data: ResumenData }) {
  const parte1 = (data as ResumenData & { parte1?: ParteUno }).parte1;

  if (!parte1) {
    return (
      <div className="bg-card rounded-xl border border-border p-6 text-muted-foreground">
        No se encontraron datos de la Parte 1 en este reporte. Vuelve al onboarding para regenerar el análisis.
      </div>
    );
  }

  const r = parte1.recurso_real;
  const c = parte1.clipping_real;
  const v = parte1.variabilidad;
  const d = parte1.diagnostico;
  const esc = parte1.escenarios_sugeridos;
  const arq = ARQUITECTURA_LABELS[d.sugerencia_arquitectura];

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-3xl font-semibold text-navy">Diagnóstico del recurso PV</h2>
        <p className="text-muted-foreground mt-1">
          Caracterización del comportamiento real de la planta tal como opera hoy. Sin escalado, sin propuesta — solo los datos del cliente.
        </p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Energía generada" value={fmtN(r.energia_total_mwh, 1)} unit="MWh" hint={`En ${r.dias_analizados} días`} />
        <MetricCard label="Pico observado" value={fmtN(r.pico_kw, 0)} unit="kW" hint={`${r.pico_vs_poi_pct.toFixed(1)}% del POI`} />
        <MetricCard label="Factor de planta" value={r.factor_planta_pct.toFixed(1)} unit="%" hint="Utilización del POI" />
        <MetricCard label="Headroom al POI" value={r.headroom_al_poi_pct.toFixed(1)} unit="%" hint="Capacidad sin usar" variant={r.headroom_al_poi_pct > 10 ? "success" : "default"} />
      </div>

      <Card className={`border-2 ${arq.color}`}>
        <CardHeader>
          <div className="flex items-baseline justify-between flex-wrap gap-2">
            <CardTitle className="text-navy text-xl">{d.tipo_principal}</CardTitle>
            <span className="text-sm font-medium text-muted-foreground">
              Arquitectura sugerida: <strong className="text-navy">{d.sugerencia_arquitectura}</strong> · {arq.titulo}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-navy/90">{d.sugerencia_texto}</p>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Justificación</p>
            <ul className="space-y-1 text-sm text-foreground">
              {d.justificacion.map((j, i) => (
                <li key={i} className="leading-snug">· {j}</li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Clipping y variabilidad: dos cards lado a lado con stats simples (omitido por brevedad — ver archivo real) */}

      <section>
        <header className="mb-4">
          <h3 className="text-2xl font-semibold text-navy">Escenarios sugeridos</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Tres configuraciones candidatas generadas a partir del diagnóstico. Puedes usar cualquiera como punto de partida en el Simulador.
          </p>
        </header>
        <div className="grid md:grid-cols-3 gap-4">
          {(["conservador", "balanceado", "agresivo"] as const).map((niv) => (
            <EscenarioCard key={niv} escenario={esc[niv]} />
          ))}
        </div>
      </section>

      <Callout variant="info">
        <p>Las cifras de esta pestaña son del comportamiento <strong>real</strong> de la planta sin escalar. Para ver la simulación de la propuesta ve a la pestaña <strong>Simulador</strong>.</p>
      </Callout>
    </div>
  );
}

// EscenarioCard subcomponente local: card con bordes coloreados según nivel (conservador / balanceado / agresivo).
// Lee escenario.pv_adicional_kw, .cap_pv_total_kw, .factor_pv_poi, .bess_p_kw, .bess_e_kwh, .bess_duracion_h,
// y opcionalmente .excedente_estimado (pico/p75/max). Estilo idéntico al de las otras cards: bg-card,
// rounded-xl, border-2, texto tabular-nums.
```

(El archivo real tiene 373 líneas; el bloque de Clipping/Variabilidad y el `EscenarioCard` están resumidos arriba — son cards adicionales con stats en pares "label / value tabular-nums" sin lógica especial.)

---

## 5. Hook representativo

**No existe un hook custom de dominio** (ej. `useResumenData`, `useSimulacion`). El proyecto usa solo los dos hooks boilerplate de shadcn:

- `src/hooks/use-mobile.tsx` — detector de breakpoint mobile genérico
- `src/hooks/use-toast.ts` — reducer/store de toasts (sonner)

El estado del análisis se obtiene leyendo directamente desde `storage.cargarAnalisis()` en `useEffect` dentro del componente página (`Index.tsx`, `Onboarding.tsx`). No hay capa de hooks ni de context entre storage y los componentes.

**Patrón usado en su lugar (Index.tsx):**

```ts
useEffect(() => {
  const estado = storage.cargarAnalisis();
  if (estado) {
    setResumen(estado.resumen);
    setCrudos(estado.crudos);
    setP(estado.propuesta.bess_p_kw); /* ... */
    return;
  }
  // fallback a JSON estático (modo demo legacy)
  fetch("/datos_resumen.json").then(r => r.json()).then(setResumen).catch(...);
}, []);
```

Si la app crece, candidato natural para extraer a `useAnalisis()`.

---

## 6. Motor de cálculo (`src/lib/`)

### 6.1 `bess-sim.ts` (111 líneas) — núcleo del motor

```ts
import type { CrudosData, DiaDetalle, SimResult } from "@/types/bess";

export function fmtN(n: number, dec = 0) {
  return new Intl.NumberFormat("es-MX", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  }).format(n);
}
export function fmtMXN(n: number) {
  return "$" + new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 }).format(n);
}
export function hourToHHMM(h: number) {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/**
 * Simulación BESS sobre serie cincominutal.
 */
export function simularBESS(
  crudos: CrudosData,
  P_kW: number,
  E_kWh: number,
  DOD = 0.95,
  RTE_total = 0.85,
): SimResult {
  const eff = Math.sqrt(RTE_total); // por etapa
  const RTE_carga = eff;
  const RTE_desc = eff;
  const DT_H = crudos.meta.resolucion_horas; // 5 min => 0.0833
  const soc_max = E_kWh * DOD;
  const P_int = P_kW * DT_H;

  let soc = 0;
  let cargado = 0, descargado = 0, perdido = 0;
  let soc_max_obs = 0;

  const diario: Record<string, DiaDetalle> = {};
  const dailySocMax: Record<string, number> = {};

  for (const [dt, gen, techo] of crudos.data) {
    const fecha = dt.slice(0, 10);
    const hora = parseInt(dt.slice(11, 13), 10);
    if (!diario[fecha]) {
      diario[fecha] = {
        horas: Array.from({ length: 24 }, (_, i) => i),
        gen: new Array(24).fill(0),
        excedente: new Array(24).fill(0),
        carga: new Array(24).fill(0),
        descarga: new Array(24).fill(0),
        soc: new Array(24).fill(0),
        perdido: new Array(24).fill(0),
      };
      dailySocMax[fecha] = 0;
    }

    const excedente = Math.max(0, gen - techo);
    const deficit = Math.max(0, techo - gen);
    let carga = 0, desc = 0;

    if (excedente > 0) {
      const espacio = (soc_max - soc) / RTE_carga;
      carga = Math.min(excedente, P_int, Math.max(0, espacio));
      soc += carga * RTE_carga;
      perdido += excedente - carga;
      cargado += carga;
    } else if (deficit > 0 && soc > 0) {
      const desc_dc = Math.min(soc, P_int / RTE_desc);
      desc = Math.min(deficit, desc_dc * RTE_desc);
      soc -= desc / RTE_desc;
      if (soc < 0) soc = 0;
      descargado += desc;
    }
    if (soc > soc_max_obs) soc_max_obs = soc;
    if (soc > dailySocMax[fecha]) dailySocMax[fecha] = soc;

    const d = diario[fecha];
    d.gen[hora] += gen * DT_H;
    d.excedente[hora] += excedente;
    d.carga[hora] += carga;
    d.descarga[hora] += desc;
    d.perdido[hora] += excedente - carga;
    d.soc[hora] = soc; // SOC al final del intervalo (último valor de la hora)
  }

  let excedente_total = 0;
  for (const [, g, t] of crudos.data) excedente_total += Math.max(0, g - t);

  let dias_saturado = 0;
  for (const f in dailySocMax) if (dailySocMax[f] >= soc_max * 0.9) dias_saturado++;

  return {
    cargado_kWh: cargado,
    descargado_kWh: descargado,
    perdido_kWh: perdido,
    pct_capturado: excedente_total > 0 ? (100 * cargado) / excedente_total : 0,
    soc_max_kWh: soc_max_obs,
    diario,
    dias_saturado,
  };
}
```

### 6.2 `analizar.ts` (191 líneas) — orquestador top-level

Punto de entrada llamado desde Onboarding tras subir el Excel:

```ts
export async function analizarPlanta(buffer: ArrayBuffer, cliente: ConfigCliente): Promise<EstadoAnalisis>
```

Pasos:

1. `cargarPerfilHorario(buffer)` desde `data-loader.ts` — parsing del Excel.
2. **Parte 1** (caracterización del recurso REAL sin escalar):
   - `caracterizarRecursoReal()` → energía total, pico, factor planta, headroom al POI
   - `detectarClippingReal()` → ¿la planta hace clipping físico hoy?
   - `calcularPerfilHorario()` → promedios/máximos por hora 0-23
   - `caracterizarVariabilidadDiaria()` → mejor/peor día, P10/P90
   - `diagnosticarOportunidad()` → arquitectura sugerida A/B/B'/C
   - `generarEscenariosPropuesta()` → tres escenarios `conservador / balanceado / agresivo`
3. **Propuesta inicial** = escenario balanceado.
4. **Parte 2** (reconstrucción 5-min + simulación):
   - `reconstruirCincominutal()` — escala por factor PV/POI y reparte cada hora en 12 slots de 5 min iguales
   - `construirDatosCrudos()` → `CrudosData` (serie tipo `[timestamp, gen_kwh, poi_kwh]`)
   - `construirDatosResumen()` → todo el `ResumenData` (corre `simularBESS` para `subdimensionada / conservadora / recomendada / sobredimensionada` + barrido Pareto + 4 simulaciones canónicas)

También expone `recalcularConPropuesta(estado, nuevaPropuesta)`: re-escala los crudos ya guardados sin reprocesar el Excel.

### 6.3 `cinco-min.ts` (439 líneas) — reconstrucción + builder de ResumenData

```ts
export interface Cincominutal {
  timestamp: string; gen_kwh: number; poi_kwh: number; fecha: string; hora: number;
}
export function reconstruirCincominutal(perfil, capPvTotalKw, poiKw): Cincominutal[]
export function construirDatosCrudos(cincominutal): CrudosData
export function construirDatosResumen(cincominutal, ctx: ContextoResumen): ResumenData

const PARETO_POTENCIAS_KW = [100, 200, 250, ...];   // barrido Pareto
const PARETO_DURACION_H = 4;
const CICLOS_EOL_LFP = 6000;                         // ciclos a 80% capacity
const VIDA_MAX_ANOS = 20;
```

`construirDatosResumen` produce el objeto completo de `ResumenData`, incluido el barrido Pareto y las 4 simulaciones canónicas (con llaves `subdimensionada / conservadora / recomendada / sobredimensionada`), más `dias_detalle` para la simulación principal.

### 6.4 `recurso.ts` (311 líneas) — Parte 1, caracterización

Exporta tipos + funciones:

```ts
export interface RecursoReal { /* energia_total_mwh, pico_kw, factor_planta_pct, ... */ }
export function caracterizarRecursoReal(perfil, poi_kw, cap_pv_kw): RecursoReal

export interface ClippingReal { /* horas_en_clipping, dias_con_clipping, hay_clipping_real, ... */ }
export function detectarClippingReal(perfil, poi_kw): ClippingReal

export interface HoraPerfil { hora; gen_kw_avg; gen_kw_max; excedente_kw_avg; excedente_kw_max; }
export interface PerfilHorarioPromedio { horas: HoraPerfil[]; ventana_punta_cfe: [number, number]; }
export function calcularPerfilHorario(perfil): PerfilHorarioPromedio

export interface Variabilidad { /* dia_mejor, dia_peor, p10, p90, dias_anomalos, ... */ }
export function caracterizarVariabilidadDiaria(perfil): Variabilidad

export function quantile(values: number[], q: number): number
export function round(n: number, decimals = 2): number

const VENTANA_PUNTA_CFE: [number, number] = [18, 22]; // constante de dominio
```

### 6.5 `diagnostico.ts` (340 líneas) — clasificación + escenarios

```ts
export type ArquitecturaSugerida = "A" | "B" | "B'" | "C";
export interface Diagnostico { tipo_principal, sugerencia_arquitectura, sugerencia_texto, justificacion: string[]; }
export type NivelEscenario = "conservador" | "balanceado" | "agresivo";
export interface Escenario { /* pv_adicional, bess_p, bess_e, duracion, excedente_estimado, ... */ }

export function diagnosticarOportunidad(recurso, clipping, perfilH): Diagnostico
export function estimarPicoExcedentePropuesto(perfil, capPvTotal, poiKw)
export function generarEscenariosPropuesta(perfil, diag, recurso, cfg): Record<NivelEscenario, Escenario>
```

### 6.6 `data-loader.ts` (176 líneas) — Excel parsing

```ts
export interface PerfilHorario { fecha: string; hora: number; energia_mwh: number; timestamp: string; }
export function cargarPerfilHorario(buffer: ArrayBuffer, cfg?: ConfigCarga): PerfilHorario[]
export function validarPerfil(perfil): { filas: number; rango_fechas: ...; ... }
```

Lee XLSX vía `xlsx`. Detecta el header dinámicamente buscando las tres columnas requeridas (Día de Operación / Hora / Energía Registrada [MWh]) entre las primeras 20 filas; tolera filas decorativas y la "Total general" final. Hora 1-24 (convención CFE) se convierte a 0-23.

### 6.7 `agregaciones.ts` (292 líneas) — buckets por granularidad temporal

```ts
export type Granularidad = "dia" | "semana" | "mes" | "trimestre" | "semestre" | "anio";
export type Bucket = { etiqueta; fechaInicio; fechaFin; excedente_kWh; pico_kW; gen_PV_kWh;
                       dias_con_excedente; dias_totales; mejor_dia; peor_dia; };
export type BucketSimulador = { etiqueta; fechaInicio; fechaFin; diasIncluidos;
                                pv_bruta_kWh; carga_kWh; descarga_kWh; perdido_kWh; soc_max_kWh; };

export const ETIQUETA_GRAN, PLURAL_GRAN, ARTICULO_PLURAL_GRAN, SOC_LABEL: Record<Granularidad, string>;

export function granularidadesDisponibles(dias: number): Granularidad[]
export function granularidadDefault(dias: number): Granularidad
export function agregarPorGranularidad(diarios: DiarioInput[], gran): Bucket[]
export function agregarDiasDetallePorGranularidad(diario: DiasDetalle, gran): BucketSimulador[]
```

Reglas (usadas por Excedente y Simulador):
- `dias < 14` → solo Día
- `dias < 60` → +Semana
- `dias < 100` → +Mes
- `dias < 180` → +Trimestre
- `dias < 330` → +Semestre
- `dias ≥ 330` → +Año

Default: la granularidad más fina que mantenga ≤ ~50 buckets visibles (Día ≤35, Semana ≤90, Mes ≤365, Trimestre >365).

### 6.8 `storage.ts` (133 líneas) — wrapper de localStorage

```ts
const PREFIX = "bess.";
export interface ConfigCliente { nombre_planta, cliente, ubicacion, poi_kw, cap_pv_instalada_kw, precio_ppa_mxn_mwh; }
export interface PropuestaConsultor { pv_adicional_kw, bess_p_kw, bess_e_kwh, dod_pct, rte_pct; }
export interface EstadoAnalisis { cliente, propuesta, parte1, crudos, resumen, timestamp; }

export const storage = {
  guardarAnalisis(estado): boolean,
  cargarAnalisis(): EstadoAnalisis | null,
  guardarPropuesta(prop): boolean,
  guardarResumen(resumen): boolean,
  guardarCrudos(crudos): boolean,
  borrarTodo(): void,
  hayAnalisis(): boolean,
};
```

Persiste en seis llaves: `bess.cliente`, `bess.propuesta`, `bess.parte1`, `bess.datos_crudos`, `bess.datos_resumen`, `bess.timestamp`. Todo serializado con `JSON.stringify`. Try/catch silencioso — devuelve `null` si parsing falla.

### 6.9 `utils.ts` (6 líneas)

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
```

---

## 7. Navegación principal

### `src/App.tsx` (29 líneas)

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import Onboarding from "./pages/Onboarding.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/onboarding" replace />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/reporte" element={<Index />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
```

**Rutas:**
- `/` → redirect a `/onboarding`
- `/onboarding` → upload de Excel + form de cliente
- `/reporte` → reporte con las 8 tabs

### `src/pages/Index.tsx` (206 líneas) — donde viven las 8 tabs

```tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { CrudosData, ResumenData } from "@/types/bess";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { TabDiagnostico } from "@/components/bess/TabDiagnostico";
import { TabResumen } from "@/components/bess/TabResumen";
import { TabExcedente } from "@/components/bess/TabExcedente";
import { TabPerfil } from "@/components/bess/TabPerfil";
import { TabSimulador } from "@/components/bess/TabSimulador";
import { TabDespacho } from "@/components/bess/TabDespacho";
import { TabPareto } from "@/components/bess/TabPareto";
import { TabDecision } from "@/components/bess/TabDecision";
import { storage } from "@/lib/storage";
import { recalcularConPropuesta } from "@/lib/analizar";

const Index = () => {
  const navigate = useNavigate();
  const [resumen, setResumen] = useState<ResumenData | null>(null);
  const [crudos, setCrudos] = useState<CrudosData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Sliders del simulador (compartidos con tab perfil)
  const [P, setP] = useState(400);
  const [E, setE] = useState(1600);
  const [DOD, setDOD] = useState(95);
  const [RTE, setRTE] = useState(85);

  useEffect(() => {
    const estado = storage.cargarAnalisis();
    if (estado) {
      setResumen(estado.resumen);
      setCrudos(estado.crudos);
      setP(estado.propuesta.bess_p_kw);
      setE(estado.propuesta.bess_e_kwh);
      setDOD(estado.propuesta.dod_pct);
      setRTE(estado.propuesta.rte_pct);
      return;
    }
    fetch("/datos_resumen.json").then((r) => r.json()).then(setResumen).catch((e) => setError(String(e)));
    fetch("/datos_crudos.json").then((r) => r.json()).then(setCrudos).catch(() => {});
  }, []);

  // … guards (loading, error) …

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-navy text-white">
        <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-6 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
              Dimensionamiento BESS · {resumen.meta.sitio}
            </h1>
            <p className="text-sm text-white/70 mt-1">
              {resumen.meta.ubicacion} · {resumen.meta.periodo_analizado} ·{" "}
              {resumen.meta.dias_analizados} días · {resumen.meta.registros_totales.toLocaleString("es-MX")} registros @ 5 min
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/onboarding")}
                  className="bg-white/10 text-white border-white/20 hover:bg-white/20 hover:text-white">
            Cargar otra planta
          </Button>
        </div>
      </header>

      <main className="max-w-[1280px] mx-auto px-4 md:px-8 py-8">
        <Tabs defaultValue="diagnostico" className="space-y-6">
          <TabsList className="w-full flex flex-wrap h-auto justify-start bg-card border border-border p-1.5 rounded-xl">
            {[
              ["diagnostico", "Diagnóstico"],
              ["resumen", "Resumen"],
              ["excedente", "Excedente diario"],
              ["perfil", "Perfil horario"],
              ["simulador", "Simulador"],
              ["despacho", "Despacho"],
              ["pareto", "Pareto"],
              ["decision", "Decisión"],
            ].map(([value, label]) => (
              <TabsTrigger key={value} value={value}
                           className="data-[state=active]:bg-navy data-[state=active]:text-white">
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* En el código real cada <TabsTrigger> está escrito explícito (sin .map). Arriba colapsado por brevedad. */}

          <TabsContent value="diagnostico" className="mt-6"><TabDiagnostico data={resumen} /></TabsContent>
          <TabsContent value="resumen"     className="mt-6"><TabResumen     data={resumen} /></TabsContent>
          <TabsContent value="excedente"   className="mt-6"><TabExcedente   data={resumen} /></TabsContent>
          <TabsContent value="perfil"      className="mt-6"><TabPerfil      data={resumen} P_kW={P} E_kWh={E} /></TabsContent>
          <TabsContent value="simulador"   className="mt-6">
            <TabSimulador data={resumen} crudos={crudos} P_kW={P} E_kWh={E} DOD={DOD} RTE={RTE}
                          setP={setP} setE={setE} setDOD={setDOD} setRTE={setRTE} />
          </TabsContent>
          <TabsContent value="despacho"    className="mt-6"><TabDespacho    data={resumen} /></TabsContent>
          <TabsContent value="pareto"      className="mt-6"><TabPareto      data={resumen} /></TabsContent>
          <TabsContent value="decision"    className="mt-6"><TabDecision    data={resumen} /></TabsContent>
        </Tabs>
      </main>

      <footer className="border-t border-border mt-12 py-6">
        <div className="max-w-[1280px] mx-auto px-4 md:px-8 text-xs text-muted-foreground text-center">
          Análisis basado en datos cincominutales · Modelo de simulación BESS
        </div>
      </footer>
    </div>
  );
};

export default Index;
```

**Notas:**
- Los sliders BESS (`P, E, DOD, RTE`) viven en Index y se inyectan al Simulador via props. Cualquier tab que necesite cambiar el sizing debería tomarlos por props también.
- `defaultValue="diagnostico"` — al entrar al reporte se ve esa pestaña primero.
- Si no hay análisis en storage, intenta hacer fetch a `/datos_resumen.json` y `/datos_crudos.json` (modo demo legacy). Esos archivos **no existen** en `public/` hoy; en producción la app siempre cae al estado "Cargando…" si entras a `/reporte` sin pasar por onboarding.

---

## 8. Mapping de datos: ¿De dónde sale `ResumenData`?

`ResumenData` se genera **client-side** a partir del Excel que el cliente sube en Onboarding. No hay backend, no hay JSON estático persistido en `/public` (los `fetch("/datos_*.json")` de Index son fallback legacy y los archivos no están servidos).

**Flujo en 3-5 líneas:**

1. Usuario va a `/onboarding`, llena form de cliente (`poi_kw`, `cap_pv_instalada_kw`, `precio_ppa_mxn_mwh`, etc.) y sube un Excel con perfil horario.
2. `Onboarding.tsx` lee el `File` como `ArrayBuffer` y llama a `analizarPlanta(buffer, config)` (src/lib/analizar.ts).
3. `analizarPlanta` parsea el Excel (data-loader), corre la caracterización Parte 1 (recurso/diagnóstico/escenarios), reconstruye la serie cincominutal y corre las simulaciones BESS (bess-sim). Devuelve un `EstadoAnalisis` con `cliente / propuesta / parte1 / crudos / resumen / timestamp`.
4. `storage.guardarAnalisis(estado)` lo persiste en localStorage (6 llaves bajo prefijo `bess.`).
5. Navigate a `/reporte` → `Index.tsx` corre `storage.cargarAnalisis()` en su `useEffect` inicial y popula los componentes de las tabs.

**Archivo donde se carga inicialmente:** `src/pages/Index.tsx`, líneas 29-50 (mostrado en sección 7).

**Archivo donde se genera:** `src/lib/analizar.ts` → `analizarPlanta()`, llamado desde `src/pages/Onboarding.tsx` líneas 32-49 (mostrado parcialmente en sección 7).

---

## 9. Convenciones de naming observadas

10 ejemplos representativos:

| Categoría | Patrón | Ejemplo |
|---|---|---|
| Componentes React | **PascalCase**, español, prefijo `Tab*` para tabs y nombre dominio para subcomponentes | `TabDespacho`, `DespachoNarrativa`, `MetricCard`, `HeatmapDiaHora` |
| Páginas | PascalCase, una palabra, en español o sustantivo descriptivo | `Index.tsx`, `Onboarding.tsx`, `NotFound.tsx` |
| Tipos / interfaces | **PascalCase**, en español, sin `I` prefix | `ResumenData`, `SimulacionPre`, `DiaDetalle`, `EstadoAnalisis`, `ConfigCliente`, `PropuestaConsultor` |
| Variables de estado React | **camelCase** español; sliders BESS usan iniciales upper para coincidir con la convención física (`P_kW`, `E_kWh`, `DOD`, `RTE`) | `resumen`, `crudos`, `procesando`, `archivo`, `gran`, `rango`, `bucketsVisibles` |
| Setters | `setX` estándar React, conserva forma del state | `setResumen`, `setP`, `setRango`, `setGran`, `setVista` |
| Props | camelCase español; nombres físicos en upper cuando son magnitudes (`P_kW`, `E_kWh`, `DOD_pct`, `RTE_pct`) | `data`, `escenario`, `filas`, `crudos`, `P_kW`, `setE` |
| Funciones helper en lib | **camelCase** español, verbo+sustantivo | `simularBESS`, `caracterizarRecursoReal`, `agregarPorGranularidad`, `reconstruirCincominutal`, `construirDatosResumen`, `calcularPromediosHorarios` |
| Constantes módulo | **UPPER_SNAKE** | `HORA_PUNTA_INI`, `HORA_PUNTA_FIN`, `PARETO_POTENCIAS_KW`, `CICLOS_EOL_LFP`, `VIDA_MAX_ANOS`, `VENTANA_PUNTA_CFE` |
| Records de labels | UPPER_SNAKE para el record, valores en español | `ETIQUETA_GRAN`, `PLURAL_GRAN`, `ARTICULO_PLURAL_GRAN`, `SOC_LABEL`, `ARQUITECTURA_LABELS` |
| Llaves de storage | snake_case en español bajo prefijo `bess.` | `bess.cliente`, `bess.propuesta`, `bess.datos_resumen`, `bess.timestamp` |

**Idioma:** español en código de dominio (BESS), inglés solo en API React/TypeScript estándar (`useState`, `props`, `onClick`, `onValueChange`, `value`). Archivos como `bess-sim.ts`, `cinco-min.ts`, `agregaciones.ts` están **en español**; los nombres de paquetes externos (`recharts`, `react-router-dom`) quedan en inglés naturalmente.

**Unidades en nombres de variables:** sufijo con la unidad cuando es ambiguo. `descargado_kWh`, `pico_kW`, `E_kWh`, `P_kW`, `valor_extra_MXN_mes`, `duracion_promedio_h`, `cap_pv_total_kW`.

---

## 10. Patrones de UI repetidos

### 10.1 Patrón "header con título + subtítulo en muted"

Cada Tab abre con:

```tsx
<header>
  <h2 className="text-3xl font-semibold text-navy">{titulo}</h2>
  <p className="text-muted-foreground mt-1">{subtitulo descriptivo}</p>
</header>
```

Usado en TabDiagnostico, TabResumen, TabExcedente, TabPerfil, TabSimulador, TabDespacho, TabDecision. Variantes menores: TabSimulador agrega un dot animado en pulsing (`bg-sky animate-pulse`) durante recompute; TabDespacho usa "cliente-friendly" tono (no jerga); TabResumen ahora tiene un `<span>` badge inline-block como sub-row.

### 10.2 Patrón "card de contenido"

Card estándar — clase repetida casi idéntica en todos los tabs:

```tsx
<div
  className="bg-card rounded-xl border border-border p-5"
  style={{ boxShadow: "var(--shadow-card)" }}
>
  <h3 className="text-lg font-semibold text-navy mb-4">{titulo}</h3>
  {/* contenido */}
</div>
```

Variantes:
- `space-y-4` o `space-y-3` cuando hay sub-secciones.
- `space-y-2` cuando es ultracompacto.
- `text-lg font-semibold text-navy` para `<h3>` de la card; `text-xs text-muted-foreground` para subtítulo bajo el `<h3>`.

### 10.3 Patrón "métrica visible / desglose técnico"

Aparece en TabDespacho (vista cliente arriba + accordion técnico abajo) y en TabExcedente (gráfica + KPIs reactivos + accordion "Tabla completa de los X días"). El patrón es:

1. Card hero con frase + chart simple (sin jerga).
2. Bloque de 3-4 KPIs claros.
3. `<Accordion type="single" collapsible>` con un único `<AccordionItem>` cuyo `<AccordionTrigger>` lleva texto explícito tipo "Ver detalles técnicos del despacho" o "Tabla completa de las X semanas", y adentro la tabla con `<Table>` de shadcn (estilo `tabular-nums` en todas las celdas numéricas, `text-right` en columnas de números).

### 10.4 Patrón "MetricCard"

`src/components/bess/MetricCard.tsx`:

```tsx
<MetricCard
  label="Curtailment (perdido)"
  value={fmtN(r.curtailment_MWh, 1)}
  unit="MWh"
  hint={`${r.curtailment_pct.toFixed(1)}% del total`}
  variant="danger"  // default | danger | success | highlight
/>
```

Estructura interna: `<div className="metric-card flex flex-col gap-1 {variant}">` con `.metric-label` (uppercase, muted, xs), `.metric-value` (3xl, semibold, navy, tabular-nums) + `unit` lado a lado en baseline, y `hint` opcional debajo en xs muted. Usado masivamente en TabResumen, TabDiagnostico, TabExcedente, TabSimulador.

### 10.5 Patrón "Callout"

`src/components/bess/Callout.tsx` (componente propio, no de shadcn) — bloque con barra vertical de color a la izquierda y `bg-{color}/5 border-{color}/30`:

```tsx
<Callout variant="info">
  <p>Texto narrativo con <strong>énfasis</strong>.</p>
</Callout>
```

Variantes: `info` (sky), `warning` (pv/orange), `success`. Usado al final de TabResumen, TabDiagnostico, TabDecision para resumen narrativo.

### 10.6 Patrón "TabsList para selector de granularidad/vista"

En TabExcedente y TabSimulador, dentro de la card del chart:

```tsx
<Tabs value={gran} onValueChange={(v) => setGran(v as Granularidad)}>
  <div className="flex flex-wrap items-center justify-between gap-3">
    <div>
      <h3 className="text-lg font-semibold text-navy">{tituloCard}</h3>
      <p className="text-xs text-muted-foreground">{subtituloCard}</p>
    </div>
    <TabsList className="h-auto bg-secondary/40 border border-border p-1 rounded-lg">
      {disponibles.map((g) => (
        <TabsTrigger key={g} value={g}
                     className="data-[state=active]:bg-navy data-[state=active]:text-white px-3 py-1 text-sm">
          {ETIQUETA_GRAN[g]}
        </TabsTrigger>
      ))}
    </TabsList>
  </div>
</Tabs>
```

(Mismo color de "active" en navy/blanco que el `<TabsList>` principal en Index.tsx.)

### 10.7 Anti-patrón observado: no hay icons

Consigna del proyecto: **no usar `lucide-react`** en componentes user-facing del dominio. Los primitivos de `components/ui/` lo usan internamente (`Check` en selects, `X` en dialogs, `ChevronDown` en accordion), eso queda. Pero los `TabDespacho` / `TabPerfil` / `Callout` / etc. no muestran iconos decorativos — un par de emojis ✅⚠️ que quedaron en TabPerfil ya se removieron.

---

## 11. Estado de cada módulo

| Tab / Módulo | Archivo principal | Qué hace |
|---|---|---|
| **Diagnóstico** | `TabDiagnostico.tsx` | Caracterización Parte 1: recurso real (energía, pico, factor planta, headroom), detección de clipping físico, variabilidad diaria (P10/P90/anómalos) y diagnóstico arquitectónico A/B/B'/C con 3 escenarios sugeridos. |
| **Resumen** | `TabResumen.tsx` | Vista del escenario proyectado (actual + overbuild propuesto). 8 MetricCards con `recurso_pv` + badge "Escenario propuesto: PV X + Y kW de overbuild" + Callout narrativo sobre curtailment. |
| **Excedente diario** | `TabExcedente.tsx` | Bar chart de excedente_kWh por bucket (Día/Semana/Mes/Trim/Sem/Año, granularidad seleccionable). RangeSlider de 2 thumbs para sub-rango. KPIs reactivos (promedio/mediana/P90/máx recomputados sobre rango visible). Histograma de distribución diaria (siempre global). Accordion con tabla por bucket. |
| **Perfil horario** | `TabPerfil.tsx` | ComposedChart de promedio/máximo de gen por hora 0-23 con ventanas carga/descarga señalizadas. Cards de ventana de carga vs descarga con margen. **Nuevo:** Heatmap día×hora SVG (`HeatmapDiaHora.tsx`) con rampa YlOrRd; auto-agrupa por semana si dias > 60. |
| **Simulador** | `TabSimulador.tsx` | Sidebar con sliders BESS (P, E, DOD, RTE) que recomputan en vivo via `simularBESS()`. Chart de despacho agregado por granularidad seleccionable (Día/Semana/Mes/Trim/Sem/Año). RangeSlider. KPIs globales (% capturado, MWh extra, ciclos/año) + mini-metrics reactivos. Accordion con tabla por bucket. |
| **Despacho** | `TabDespacho.tsx` + 3 subcomponentes | Vista cliente-friendly con frase narrativa dinámica + chart de día promedio (carga + descarga + gen solar + banda CFE 18-22h) + 3 KPIs de negocio (MXN/año, kWh/día, ciclos/año con calificador) + nota técnica del efecto óptico carga vs descarga + accordion técnico con tabla horaria. |
| **Pareto** | `TabPareto.tsx` | Scatter/línea de las simulaciones del barrido Pareto (variar P, fijar duración 4h): `pct_capturado` vs `E_kWh` aproximadamente. Identifica el "codo" para argumentar el sizing. |
| **Decisión** | `TabDecision.tsx` | Argumento técnico cerrado: 4 ReasoningCards (cuánta energía, qué tan rápido, cuántas horas opera, vacíado nocturno) que usan datos del `recomendacion` + sim "recomendada" + `estadisticos_excedente`. Tabla comparativa de las 4 simulaciones canónicas con la fila recomendada resaltada. Callouts de configuración recomendada + limitaciones del análisis. |
| **Onboarding** | `pages/Onboarding.tsx` | Form de cliente (POI, cap PV instalada, precio PPA, etc.) + file input de Excel. Llama `analizarPlanta()` y persiste en storage. |
| **Motor** | `lib/bess-sim.ts` + `lib/cinco-min.ts` | `simularBESS()` (cincominutal con SOC, DOD, RTE round-trip), reconstrucción 5-min desde perfil horario via factor PV/POI. Replica del Motor_BESS_v3.ipynb del Colab. |
| **Parte 1** | `lib/recurso.ts` + `lib/diagnostico.ts` | Caracterización del recurso real (sin escalar), detección de clipping físico, variabilidad diaria, diagnóstico arquitectónico A/B/B'/C, generador de 3 escenarios. |
| **Persistencia** | `lib/storage.ts` | localStorage tipado, 6 llaves bajo prefijo `bess.`. No hay backend ni servidor. |

**Pendientes conocidos** (no implementado al momento de generar este dossier):

- Sankey de flujo de energía en Despacho (estaba planeado como entregable 3 de un sprint que se interrumpió; requiere `@nivo/sankey` que aún no está instalado).
- Tests de paridad contra `Motor_BESS_v3.ipynb` están fixture-gated (`src/test/colab-parity.test.ts`) — el archivo `REPORTE_ESTANZUELA_2_MAR_2026.xlsx` no está en `src/test/fixtures/` por defecto.
- Hook `useAnalisis()` no existe — cada página llama `storage.cargarAnalisis()` directamente desde un `useEffect`.
- Bug latente posible en `bess-sim.ts:88` (`d.gen[hora] += gen * DT_H`): el Colab no multiplica por `DT_H` aquí porque `gen` ya está en kWh por slot de 5 min. La discrepancia afecta solo la barra de gen del chart del Simulador, no los cálculos de `cargado/descargado/perdido/soc/pct_capturado`. Sin corregir aún.
