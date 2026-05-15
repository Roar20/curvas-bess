/**
 * Diagnóstico automático del tipo de oportunidad y generación de escenarios.
 *
 * Réplica de diagnosticar_oportunidad() y generar_escenarios_propuesta() del Colab.
 */
import type { PerfilHorario } from "./data-loader";
import type {
  ClippingReal,
  PerfilHorarioPromedio,
  RecursoReal,
} from "./recurso";
import { quantile, round } from "./recurso";

/* ============================================================================
 * Tipos
 * ========================================================================== */

export type ArquitecturaSugerida = "A" | "B" | "B'" | "C";

export interface Diagnostico {
  tipo_principal: string;
  sugerencia_arquitectura: ArquitecturaSugerida;
  sugerencia_texto: string;
  justificacion: string[];
  senales: {
    horas_con_clipping_pct: number;
    pico_vs_poi_pct: number;
    headroom_disponible_pct: number;
    energia_en_punta_pct: number;
    generacion_termina_antes_punta: boolean;
  };
}

export type NivelEscenario = "conservador" | "balanceado" | "agresivo";

export interface ExcedenteEstimado {
  pico_kw: number;
  p75_diario_kwh: number;
  mediana_diaria_kwh: number;
  max_diario_kwh: number;
  dias_con_excedente: number;
}

export interface Escenario {
  nivel: NivelEscenario;
  pv_adicional_kw: number;
  cap_pv_total_kw: number;
  factor_pv_poi: number;
  bess_p_kw: number;
  bess_e_kwh: number;
  bess_duracion_h: number;
  dod_pct: number;
  rte_pct: number;
  excedente_estimado: ExcedenteEstimado | null;
  justificacion: string;
}

export interface ConfigCliente {
  poi_kw: number;
  cap_pv_instalada_kw: number;
}

/* ============================================================================
 * Diagnóstico automático
 * ========================================================================== */

export function diagnosticarOportunidad(
  recurso: RecursoReal,
  clipping: ClippingReal,
  perfilHorario: PerfilHorarioPromedio,
): Diagnostico {
  const pct_clip = clipping.pct_horas_clipping;
  const pico_pct = recurso.pico_vs_poi_pct;
  const headroom_pct = recurso.headroom_al_poi_pct;
  const pct_punta = perfilHorario.pct_energia_en_punta;
  const hora_fin = perfilHorario.hora_fin_generacion;
  const hora_punta_ini = perfilHorario.ventana_punta_cfe[0];

  const generacion_termina_antes_punta =
    hora_fin !== null && hora_fin < hora_punta_ini;

  const senales = {
    horas_con_clipping_pct: pct_clip,
    pico_vs_poi_pct: pico_pct,
    headroom_disponible_pct: headroom_pct,
    energia_en_punta_pct: pct_punta,
    generacion_termina_antes_punta,
  };

  // Caso 1: clipping físico significativo
  if (pct_clip > 5.0) {
    return {
      tipo_principal: "Clipping físico significativo",
      sugerencia_arquitectura: "A",
      sugerencia_texto:
        `Arquitectura A — solo BESS. ${pct_clip.toFixed(1)}% de las horas con generación ` +
        `tocan el POI. Hay clipping real para capturar.`,
      justificacion: [
        `El ${pct_clip.toFixed(1)}% de las horas con generación operan en el límite del POI.`,
        `En ${clipping.dias_con_clipping} de ${clipping.dias_totales} días hay clipping.`,
        `Un BESS dimensionado para absorber este recorte puede desplazarlo a otras horas.`,
      ],
      senales,
    };
  }

  // Caso 2: headroom alto
  if (pico_pct < 80.0) {
    if (pct_punta < 5.0 && generacion_termina_antes_punta) {
      return {
        tipo_principal: "Headroom alto + generación NO coincide con punta CFE",
        sugerencia_arquitectura: "B'",
        sugerencia_texto:
          `Arquitectura B' — agregar PV adicional + BESS. La planta opera al ` +
          `${pico_pct.toFixed(0)}% del POI y termina de generar a las ${hora_fin}h, ` +
          `antes de la hora punta. Hay oportunidad doble: aprovechar el ` +
          `headroom y desplazar a horas valiosas.`,
        justificacion: [
          `El pico observado es ${pico_pct.toFixed(1)}% del POI — el ${headroom_pct.toFixed(1)}% del POI no se usa.`,
          `Solo ${pct_punta.toFixed(1)}% de la energía coincide con hora punta CFE (18-22h).`,
          `La generación termina a las ${hora_fin}h, antes de las ${hora_punta_ini}h.`,
          `Agregar PV adicional saturaría el POI durante el día, y el BESS desplazaría ese sobrante a la hora punta.`,
        ],
        senales,
      };
    }
    return {
      tipo_principal: "Headroom alto",
      sugerencia_arquitectura: "B",
      sugerencia_texto:
        `Arquitectura B — considerar agregar PV adicional. La planta opera ` +
        `al ${pico_pct.toFixed(0)}% del POI; hay ${headroom_pct.toFixed(0)}% de capacidad sin usar.`,
      justificacion: [
        `El pico es ${pico_pct.toFixed(1)}% del POI; ${headroom_pct.toFixed(1)}% del POI nunca se aprovecha.`,
        `Una expansión de PV puede llenar ese headroom y generar más energía.`,
        `Si la nueva PV produce más que el POI en horas pico, un BESS captura el clipping resultante.`,
      ],
      senales,
    };
  }

  // Caso 3: planta ya optimizada
  if (pct_clip === 0 && pico_pct >= 90.0) {
    return {
      tipo_principal: "Planta ya optimizada",
      sugerencia_arquitectura: "C",
      sugerencia_texto:
        `Arquitectura C — no recomendar inversión inmediata. La planta opera ` +
        `al ${pico_pct.toFixed(0)}% del POI sin clipping. Margen de mejora limitado.`,
      justificacion: [
        `El pico (${pico_pct.toFixed(1)}% del POI) es alto pero sin tocar el límite.`,
        `No hay clipping físico ni headroom relevante.`,
        `La estrategia tiene que venir de un cambio en estrategia comercial, no técnica.`,
      ],
      senales,
    };
  }

  // Caso 4: intermedio
  return {
    tipo_principal: "Caso intermedio",
    sugerencia_arquitectura: "B",
    sugerencia_texto:
      `Arquitectura B — explorar PV adicional moderada. La planta opera al ` +
      `${pico_pct.toFixed(0)}% del POI sin clipping significativo.`,
    justificacion: [
      `Pico al ${pico_pct.toFixed(1)}% del POI, sin clipping físico.`,
      `Headroom moderado de ${headroom_pct.toFixed(1)}% — vale la pena modelar escenarios.`,
    ],
    senales,
  };
}

/* ============================================================================
 * Estimación de excedente al escalar
 * ========================================================================== */

export function estimarPicoExcedentePropuesto(
  perfil: PerfilHorario[],
  capPvTotalKw: number,
  poiKw: number,
): ExcedenteEstimado {
  const factor = capPvTotalKw / poiKw;
  const poiMwh = poiKw / 1000;

  // Excedente por hora (en MWh)
  let pico_kw = 0;
  const porDia = new Map<string, number>();

  for (const p of perfil) {
    const pvBruta = p.energia_mwh * factor;
    const excedente = Math.max(0, pvBruta - poiMwh);
    const excedenteKw = excedente * 1000;
    if (excedenteKw > pico_kw) pico_kw = excedenteKw;
    porDia.set(p.fecha, (porDia.get(p.fecha) ?? 0) + excedente);
  }

  // Convertir el excedente diario a kWh
  const dias = Array.from(porDia.values()).map((v) => v * 1000);
  const positivos = dias.filter((v) => v > 0);

  return {
    pico_kw: round(pico_kw, 1),
    p75_diario_kwh: positivos.length > 0 ? round(quantile(positivos, 0.75), 1) : 0,
    mediana_diaria_kwh:
      positivos.length > 0 ? round(quantile(positivos, 0.5), 1) : 0,
    max_diario_kwh: positivos.length > 0 ? round(Math.max(...positivos), 1) : 0,
    dias_con_excedente: positivos.length,
  };
}

/* ============================================================================
 * Recomendación de PV adicional
 * ========================================================================== */

function recomendarPvAdicional(
  diagnostico: Diagnostico,
  recurso: RecursoReal,
  cliente: ConfigCliente,
  nivel: NivelEscenario,
): number {
  const pico_pct = recurso.pico_vs_poi_pct;
  const pv_actual = cliente.cap_pv_instalada_kw;
  const arq = diagnostico.sugerencia_arquitectura;

  // Si hay clipping real, no recomendar más PV
  if (arq === "A") return 0;
  // Si la planta ya está optimizada, recomendar nada
  if (arq === "C") return 0;

  // Caso B / B': ratios según pico vs POI
  let ratios: Record<NivelEscenario, number>;
  if (pico_pct < 70) {
    ratios = { conservador: 0.3, balanceado: 0.5, agresivo: 0.8 };
  } else if (pico_pct < 85) {
    ratios = { conservador: 0.4, balanceado: 0.7, agresivo: 1.0 };
  } else {
    ratios = { conservador: 0.5, balanceado: 0.8, agresivo: 1.2 };
  }

  const pv_adicional = pv_actual * ratios[nivel];
  // Redondear a múltiplos de 50 kW
  return Math.round(pv_adicional / 50) * 50;
}

/* ============================================================================
 * Dimensionamiento del BESS
 * ========================================================================== */

interface DimensionamientoBess {
  p_kw: number;
  e_kwh: number;
  duracion_h: number;
  factor_pico: number;
  excedente: ExcedenteEstimado | null;
  justificacion: string;
}

function dimensionarBess(
  perfil: PerfilHorario[],
  capPvTotalKw: number,
  poiKw: number,
  nivel: NivelEscenario,
  duracion_h = 4,
): DimensionamientoBess {
  if (capPvTotalKw <= poiKw) {
    return {
      p_kw: 0,
      e_kwh: 0,
      duracion_h: 0,
      factor_pico: 0,
      excedente: null,
      justificacion: "Sin PV adicional, no hay excedente que capturar.",
    };
  }

  const excedente = estimarPicoExcedentePropuesto(perfil, capPvTotalKw, poiKw);

  const factores: Record<NivelEscenario, number> = {
    conservador: 0.7,
    balanceado: 1.0,
    agresivo: 1.3,
  };
  const factor_pico = factores[nivel];
  const p_bruto = excedente.pico_kw * factor_pico;

  // No tiene sentido un BESS más grande que el POI
  let p_kw = Math.min(p_bruto, poiKw);
  // Redondear a múltiplos de 25 kW
  p_kw = Math.round(p_kw / 25) * 25;
  const e_kwh = p_kw * duracion_h;

  return {
    p_kw,
    e_kwh,
    duracion_h,
    factor_pico,
    excedente,
    justificacion:
      `Potencia = ${(factor_pico * 100).toFixed(0)}% del pico estimado ` +
      `(${excedente.pico_kw.toFixed(0)} kW). Duración fija ${duracion_h}h ` +
      `para cubrir hora punta CFE.`,
  };
}

/* ============================================================================
 * Generación de los 3 escenarios
 * ========================================================================== */

export function generarEscenariosPropuesta(
  perfil: PerfilHorario[],
  diagnostico: Diagnostico,
  recurso: RecursoReal,
  cliente: ConfigCliente,
): Record<NivelEscenario, Escenario> {
  const niveles: NivelEscenario[] = ["conservador", "balanceado", "agresivo"];
  const escenarios = {} as Record<NivelEscenario, Escenario>;

  for (const nivel of niveles) {
    const pv_adicional = recomendarPvAdicional(diagnostico, recurso, cliente, nivel);
    const cap_pv_total = cliente.cap_pv_instalada_kw + pv_adicional;
    const bess = dimensionarBess(perfil, cap_pv_total, cliente.poi_kw, nivel);

    escenarios[nivel] = {
      nivel,
      pv_adicional_kw: pv_adicional,
      cap_pv_total_kw: cap_pv_total,
      factor_pv_poi: round(cap_pv_total / cliente.poi_kw, 2),
      bess_p_kw: bess.p_kw,
      bess_e_kwh: bess.e_kwh,
      bess_duracion_h: bess.duracion_h,
      dod_pct: 95,
      rte_pct: 85,
      excedente_estimado: bess.excedente,
      justificacion: bess.justificacion,
    };
  }

  return escenarios;
}
