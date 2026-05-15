/**
 * Caracterización del recurso PV de la planta tal como está hoy.
 *
 * Todas las funciones aquí trabajan con la generación REAL del cliente,
 * SIN escalar por overbuild. Réplica de las funciones de Parte 1 del Colab.
 */
import type { PerfilHorario } from "./data-loader";

/* ============================================================================
 * Caracterización general
 * ========================================================================== */

export interface RecursoReal {
  energia_total_mwh: number;
  pico_kw: number;
  horas_totales: number;
  dias_analizados: number;
  factor_planta_pct: number;
  factor_capacidad_pct: number;
  horas_sol_equiv_diaria: number;
  headroom_al_poi_pct: number;
  pico_vs_poi_pct: number;
}

/**
 * Métricas del comportamiento real de la planta.
 *
 * @param perfil Perfil horario del cliente (Registrada sin escalar)
 * @param poiKw Techo del POI según contrato de interconexión
 * @param capPvInstaladaKw Capacidad PV instalada actual de la planta
 */
export function caracterizarRecursoReal(
  perfil: PerfilHorario[],
  poiKw: number,
  capPvInstaladaKw: number,
): RecursoReal {
  if (perfil.length === 0) {
    throw new Error("Perfil vacío");
  }

  const energia_total_mwh = perfil.reduce((acc, p) => acc + p.energia_mwh, 0);
  const pico_kw = perfil.reduce((m, p) => Math.max(m, p.energia_mwh), 0) * 1000;
  const horas_total = perfil.length;
  const fechas = new Set(perfil.map((p) => p.fecha));
  const dias = fechas.size;

  const factor_planta_pct =
    ((energia_total_mwh * 1000) / (poiKw * horas_total)) * 100;
  const factor_capacidad_pct =
    ((energia_total_mwh * 1000) / (capPvInstaladaKw * horas_total)) * 100;
  const horas_sol_equiv =
    dias > 0 ? (energia_total_mwh * 1000) / capPvInstaladaKw / dias : 0;
  const headroom_pct = ((poiKw - pico_kw) / poiKw) * 100;

  return {
    energia_total_mwh: round(energia_total_mwh, 4),
    pico_kw: round(pico_kw, 2),
    horas_totales: horas_total,
    dias_analizados: dias,
    factor_planta_pct: round(factor_planta_pct, 2),
    factor_capacidad_pct: round(factor_capacidad_pct, 2),
    horas_sol_equiv_diaria: round(horas_sol_equiv, 2),
    headroom_al_poi_pct: round(headroom_pct, 2),
    pico_vs_poi_pct: round((pico_kw / poiKw) * 100, 2),
  };
}

/* ============================================================================
 * Detección de clipping real
 * ========================================================================== */

export interface ClippingReal {
  horas_en_clipping: number;
  horas_con_generacion: number;
  pct_horas_clipping: number;
  dias_con_clipping: number;
  dias_totales: number;
  umbral_kwh_horario: number;
  hay_clipping_real: boolean;
}

/**
 * Detecta horas donde la Registrada llega al techo del POI (clipping físico).
 *
 * Criterio: Registrada ≥ POI × (1 - tolerancia/100). La tolerancia absorbe
 * ruido de medición; default 1%.
 */
export function detectarClippingReal(
  perfil: PerfilHorario[],
  poiKw: number,
  tolerancia_pct = 1.0,
): ClippingReal {
  const umbralMwh = (poiKw / 1000) * (1 - tolerancia_pct / 100);

  let enClipping = 0;
  let conGen = 0;
  const diasConClip = new Set<string>();
  const diasTotales = new Set<string>();

  for (const p of perfil) {
    diasTotales.add(p.fecha);
    if (p.energia_mwh > 0) conGen++;
    if (p.energia_mwh >= umbralMwh) {
      enClipping++;
      diasConClip.add(p.fecha);
    }
  }

  return {
    horas_en_clipping: enClipping,
    horas_con_generacion: conGen,
    pct_horas_clipping: conGen > 0 ? round((enClipping / conGen) * 100, 2) : 0,
    dias_con_clipping: diasConClip.size,
    dias_totales: diasTotales.size,
    umbral_kwh_horario: round(umbralMwh * 1000, 2),
    hay_clipping_real: enClipping > 0,
  };
}

/* ============================================================================
 * Perfil horario promedio
 * ========================================================================== */

export interface HoraPerfil {
  hora: number;
  kW_promedio: number;
  kW_maximo: number;
}

export interface PerfilHorarioPromedio {
  /** Una entrada por hora del día (1-24) */
  por_hora: HoraPerfil[];
  /** Primera hora con generación >5% del pico */
  hora_inicio_generacion: number | null;
  /** Última hora con generación >5% del pico */
  hora_fin_generacion: number | null;
  /** Hora del pico promedio */
  hora_pico: number;
  /** Ventana hora-punta CFE GDMTH [inicio, fin] */
  ventana_punta_cfe: [number, number];
  /** Energía generada durante hora-punta CFE */
  energia_durante_punta_mwh: number;
  /** % de la energía total durante hora-punta CFE */
  pct_energia_en_punta: number;
}

const VENTANA_PUNTA_CFE: [number, number] = [18, 22];

export function calcularPerfilHorario(
  perfil: PerfilHorario[],
): PerfilHorarioPromedio {
  // Agrupar por hora del día
  const porHora = new Map<number, { sum: number; max: number; n: number }>();
  for (let h = 1; h <= 24; h++) porHora.set(h, { sum: 0, max: 0, n: 0 });

  for (const p of perfil) {
    const acc = porHora.get(p.hora);
    if (!acc) continue;
    const kw = p.energia_mwh * 1000; // MWh/h = kW promedio durante esa hora
    acc.sum += kw;
    acc.max = Math.max(acc.max, kw);
    acc.n++;
  }

  const por_hora: HoraPerfil[] = [];
  for (let h = 1; h <= 24; h++) {
    const acc = porHora.get(h)!;
    por_hora.push({
      hora: h,
      kW_promedio: acc.n > 0 ? round(acc.sum / acc.n, 2) : 0,
      kW_maximo: round(acc.max, 2),
    });
  }

  // Ventana de generación (>5% del pico)
  const picoProm = Math.max(...por_hora.map((h) => h.kW_promedio));
  const umbral = picoProm * 0.05;
  const conGen = por_hora.filter((h) => h.kW_promedio > umbral);
  const hora_inicio_generacion = conGen.length > 0 ? conGen[0].hora : null;
  const hora_fin_generacion =
    conGen.length > 0 ? conGen[conGen.length - 1].hora : null;
  const hora_pico = por_hora.reduce(
    (best, h) => (h.kW_promedio > best.kW_promedio ? h : best),
    por_hora[0],
  ).hora;

  // Energía durante hora-punta CFE
  const [hp1, hp2] = VENTANA_PUNTA_CFE;
  const energia_en_punta = perfil
    .filter((p) => p.hora >= hp1 && p.hora <= hp2)
    .reduce((acc, p) => acc + p.energia_mwh, 0);
  const energia_total = perfil.reduce((acc, p) => acc + p.energia_mwh, 0);
  const pct_punta = energia_total > 0 ? (energia_en_punta / energia_total) * 100 : 0;

  return {
    por_hora,
    hora_inicio_generacion,
    hora_fin_generacion,
    hora_pico,
    ventana_punta_cfe: VENTANA_PUNTA_CFE,
    energia_durante_punta_mwh: round(energia_en_punta, 4),
    pct_energia_en_punta: round(pct_punta, 2),
  };
}

/* ============================================================================
 * Variabilidad día a día
 * ========================================================================== */

export interface Variabilidad {
  dia_mejor_fecha: string;
  dia_mejor_mwh: number;
  dia_peor_fecha: string;
  dia_peor_mwh: number;
  promedio_mwh: number;
  mediana_mwh: number;
  p10_mwh: number;
  p90_mwh: number;
  coef_variacion: number;
  dias_anomalos: string[];
  n_dias_anomalos: number;
  serie_diaria: Record<string, number>;
}

export function caracterizarVariabilidadDiaria(
  perfil: PerfilHorario[],
): Variabilidad {
  // Agrupar por fecha
  const porDia = new Map<string, number>();
  for (const p of perfil) {
    porDia.set(p.fecha, (porDia.get(p.fecha) ?? 0) + p.energia_mwh);
  }

  const entradas = Array.from(porDia.entries()).sort((a, b) =>
    a[0].localeCompare(b[0]),
  );
  const valores = entradas.map(([, v]) => v);
  const fechas = entradas.map(([f]) => f);

  if (valores.length === 0) {
    throw new Error("Sin datos diarios");
  }

  const max = Math.max(...valores);
  const min = Math.min(...valores);
  const sum = valores.reduce((a, b) => a + b, 0);
  const mean = sum / valores.length;
  const variance =
    valores.reduce((acc, v) => acc + (v - mean) ** 2, 0) / valores.length;
  const std = Math.sqrt(variance);

  const dia_mejor_fecha = fechas[valores.indexOf(max)];
  const dia_peor_fecha = fechas[valores.indexOf(min)];

  const p10 = quantile(valores, 0.1);
  const p90 = quantile(valores, 0.9);
  const median = quantile(valores, 0.5);

  // Días anómalos: por debajo de P10
  const dias_anomalos = entradas
    .filter(([, v]) => v < p10)
    .sort((a, b) => a[1] - b[1])
    .map(([f]) => f);

  const serie_diaria: Record<string, number> = {};
  for (const [f, v] of entradas) serie_diaria[f] = v;

  return {
    dia_mejor_fecha,
    dia_mejor_mwh: round(max, 4),
    dia_peor_fecha,
    dia_peor_mwh: round(min, 4),
    promedio_mwh: round(mean, 4),
    mediana_mwh: round(median, 4),
    p10_mwh: round(p10, 4),
    p90_mwh: round(p90, 4),
    coef_variacion: mean > 0 ? round(std / mean, 3) : 0,
    dias_anomalos,
    n_dias_anomalos: dias_anomalos.length,
    serie_diaria,
  };
}

/* ============================================================================
 * Utilidades numéricas
 * ========================================================================== */

/**
 * Percentil con interpolación lineal (equivalente a numpy.quantile default).
 *
 * @param values Array de valores
 * @param q Probabilidad entre 0 y 1
 */
export function quantile(values: number[], q: number): number {
  if (values.length === 0) return 0;
  if (q < 0 || q > 1) {
    throw new Error(`Quantile q debe estar en [0, 1], recibido ${q}`);
  }
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0];
  const pos = q * (sorted.length - 1);
  const base = Math.floor(pos);
  const frac = pos - base;
  if (base + 1 >= sorted.length) return sorted[base];
  return sorted[base] + frac * (sorted[base + 1] - sorted[base]);
}

export function round(n: number, decimals = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round(n * factor) / factor;
}
