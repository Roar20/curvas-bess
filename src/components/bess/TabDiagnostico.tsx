import type { ResumenData } from "@/types/bess";
import { MetricCard } from "./MetricCard";
import { Callout } from "./Callout";
import { fmtN } from "@/lib/bess-sim";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
    pico_kw: number;
    p75_diario_kwh: number;
    max_diario_kwh: number;
  } | null;
}

interface ParteUno {
  recurso_real: RecursoReal;
  clipping_real: ClippingReal;
  variabilidad: Variabilidad;
  diagnostico: Diagnostico;
  escenarios_sugeridos: {
    conservador: Escenario;
    balanceado: Escenario;
    agresivo: Escenario;
  };
}

const ARQUITECTURA_LABELS: Record<string, { titulo: string; color: string }> = {
  A: { titulo: "Solo BESS", color: "bg-warning/10 border-warning/30" },
  B: { titulo: "PV adicional + BESS", color: "bg-sky/10 border-sky/30" },
  "B'": {
    titulo: "PV adicional + BESS con desplazamiento",
    color: "bg-sky/15 border-sky/40",
  },
  C: { titulo: "No recomendar inversión", color: "bg-muted border-border" },
};

export function TabDiagnostico({ data }: { data: ResumenData }) {
  const parte1 = (data as ResumenData & { parte1?: ParteUno }).parte1;

  if (!parte1) {
    return (
      <div className="bg-card rounded-xl border border-border p-6 text-muted-foreground">
        No se encontraron datos de la Parte 1 en este reporte. Vuelve al
        onboarding para regenerar el análisis.
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
        <h2 className="text-3xl font-semibold text-navy">
          Diagnóstico del recurso PV
        </h2>
        <p className="text-muted-foreground mt-1">
          Caracterización del comportamiento real de la planta tal como opera hoy.
          Sin escalado, sin propuesta — solo los datos del cliente.
        </p>
      </header>

      {/* Cards principales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Energía generada"
          value={fmtN(r.energia_total_mwh, 1)}
          unit="MWh"
          hint={`En ${r.dias_analizados} días`}
        />
        <MetricCard
          label="Pico observado"
          value={fmtN(r.pico_kw, 0)}
          unit="kW"
          hint={`${r.pico_vs_poi_pct.toFixed(1)}% del POI`}
        />
        <MetricCard
          label="Factor de planta"
          value={r.factor_planta_pct.toFixed(1)}
          unit="%"
          hint="Utilización del POI"
        />
        <MetricCard
          label="Headroom al POI"
          value={r.headroom_al_poi_pct.toFixed(1)}
          unit="%"
          hint="Capacidad sin usar"
          variant={r.headroom_al_poi_pct > 10 ? "success" : "default"}
        />
      </div>

      {/* Bloque del diagnóstico */}
      <Card className={`border-2 ${arq.color}`}>
        <CardHeader>
          <div className="flex items-baseline justify-between flex-wrap gap-2">
            <CardTitle className="text-navy text-xl">
              {d.tipo_principal}
            </CardTitle>
            <span className="text-sm font-medium text-muted-foreground">
              Arquitectura sugerida:{" "}
              <strong className="text-navy">{d.sugerencia_arquitectura}</strong> ·{" "}
              {arq.titulo}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-navy/90">{d.sugerencia_texto}</p>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              Justificación
            </p>
            <ul className="space-y-1 text-sm text-foreground">
              {d.justificacion.map((j, i) => (
                <li key={i} className="leading-snug">
                  · {j}
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Clipping y variabilidad */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-navy text-base">
              Detección de clipping real
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Horas con generación</span>
              <span className="font-medium tabular-nums">
                {c.horas_con_generacion}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Horas en clipping</span>
              <span className="font-medium tabular-nums">
                {c.horas_en_clipping} ({c.pct_horas_clipping.toFixed(2)}%)
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Días con clipping</span>
              <span className="font-medium tabular-nums">
                {c.dias_con_clipping} de {c.dias_totales}
              </span>
            </div>
            <div className="mt-3 pt-3 border-t border-border">
              {c.hay_clipping_real ? (
                <p className="text-sm text-warning">
                  Hay clipping físico real: oportunidad de captura.
                </p>
              ) : (
                <p className="text-sm text-success">
                  No hay clipping real. La planta opera siempre debajo del POI.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-navy text-base">
              Variabilidad diaria
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Mejor día</span>
              <span className="font-medium tabular-nums">
                {v.dia_mejor_fecha} · {v.dia_mejor_mwh.toFixed(2)} MWh
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Peor día</span>
              <span className="font-medium tabular-nums">
                {v.dia_peor_fecha} · {v.dia_peor_mwh.toFixed(2)} MWh
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Promedio / Mediana</span>
              <span className="font-medium tabular-nums">
                {v.promedio_mwh.toFixed(2)} / {v.mediana_mwh.toFixed(2)} MWh
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">P10 / P90</span>
              <span className="font-medium tabular-nums">
                {v.p10_mwh.toFixed(2)} / {v.p90_mwh.toFixed(2)} MWh
              </span>
            </div>
            {v.dias_anomalos.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  Días anómalos (&lt;P10)
                </p>
                <p className="text-sm text-foreground">
                  {v.dias_anomalos.join(", ")}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Escenarios sugeridos */}
      <section>
        <header className="mb-4">
          <h3 className="text-2xl font-semibold text-navy">
            Escenarios sugeridos
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Tres configuraciones candidatas generadas a partir del diagnóstico.
            Puedes usar cualquiera como punto de partida en el Simulador.
          </p>
        </header>

        <div className="grid md:grid-cols-3 gap-4">
          {(["conservador", "balanceado", "agresivo"] as const).map((niv) => (
            <EscenarioCard key={niv} escenario={esc[niv]} />
          ))}
        </div>
      </section>

      <Callout variant="info">
        <p>
          Las cifras de esta pestaña son del comportamiento <strong>real</strong>{" "}
          de la planta sin escalar. Para ver la simulación de la propuesta (PV
          adicional + BESS) ve a la pestaña <strong>Simulador</strong>.
        </p>
      </Callout>
    </div>
  );
}

function EscenarioCard({ escenario }: { escenario: Escenario }) {
  const colores: Record<string, string> = {
    conservador: "border-sky/40 bg-sky-soft/20",
    balanceado: "border-success/40 bg-success/5",
    agresivo: "border-warning/40 bg-warning/5",
  };
  const titulos: Record<string, string> = {
    conservador: "Conservador",
    balanceado: "Balanceado",
    agresivo: "Agresivo",
  };

  return (
    <Card className={`border-2 ${colores[escenario.nivel]}`}>
      <CardHeader>
        <CardTitle className="text-navy text-lg">
          {titulos[escenario.nivel]}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            PV adicional
          </p>
          <p className="text-2xl font-semibold text-navy tabular-nums">
            +{escenario.pv_adicional_kw}{" "}
            <span className="text-sm font-normal text-muted-foreground">
              kW
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            Total proyecto: {escenario.cap_pv_total_kw} kW (
            {escenario.factor_pv_poi.toFixed(2)}x POI)
          </p>
        </div>

        <div className="pt-2 border-t border-border">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            BESS recomendado
          </p>
          <p className="text-lg font-semibold text-navy tabular-nums">
            {escenario.bess_p_kw} kW × {escenario.bess_e_kwh} kWh
          </p>
          <p className="text-xs text-muted-foreground">
            Duración: {escenario.bess_duracion_h}h
          </p>
        </div>

        {escenario.excedente_estimado && (
          <div className="pt-2 border-t border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Excedente estimado
            </p>
            <div className="space-y-1 text-xs mt-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pico</span>
                <span className="tabular-nums">
                  {escenario.excedente_estimado.pico_kw.toFixed(0)} kW
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">P75 diario</span>
                <span className="tabular-nums">
                  {escenario.excedente_estimado.p75_diario_kwh.toFixed(0)} kWh
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Max diario</span>
                <span className="tabular-nums">
                  {escenario.excedente_estimado.max_diario_kwh.toFixed(0)} kWh
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
