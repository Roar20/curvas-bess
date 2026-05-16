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
  /** Resultados de Parte 2 (comparativa de estrategias greedy vs arbitraje) */
  parte2?: ResultadoParte2;
}

// ──────────────────────────────────────────────────────────────────
// Parte 2 — Comparativa de estrategias
//
// Los tipos viven aquí (no en lib/estrategia.ts) para evitar un
// ciclo: types/bess.ts ↔ lib/estrategia.ts ↔ lib/bess-sim.ts ↔
// types/bess.ts. lib/estrategia.ts re-exporta estos tipos para que
// el código de aplicación tenga un único punto de import.
// ──────────────────────────────────────────────────────────────────

export type Estrategia = "greedy" | "arbitraje";

export interface PreciosMercado {
  energia_mxn_mwh: number;
  potencia_mxn_mw_mes: number;
  cel_mxn: number;
}

export interface IngresoDesglosado {
  energia_mxn: number;
  potencia_mxn: number;
  cels_mxn: number;
  total_mxn: number;
  kw_firme_garantizable: number;
  energia_total_mwh_anual: number;
  descargado_mwh_anual: number;
}

export interface ComparativaEstrategia {
  estrategia: Estrategia;
  sim: SimResult;
  ingreso: IngresoDesglosado;
}

export interface ResultadoParte2 {
  greedy: ComparativaEstrategia;
  arbitraje: ComparativaEstrategia;
  ganadora: Estrategia;
  ventaja_mxn_anual: number;
  precios_usados: PreciosMercado;
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
  ciclos_periodo: number;
  ciclos_ano: number;
  vida_util_anos: number;
  energia_extra_MWh_periodo: number;
  valor_extra_MXN_periodo: number;
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
