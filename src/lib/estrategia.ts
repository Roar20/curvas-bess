/**
 * Comparativa de estrategias de despacho del BESS: greedy vs arbitraje.
 *
 * Constantes de mercado son proxy del contrato Estanzuela 2; deben
 * confirmarse contra el contrato real del cliente antes de presentar
 * conclusiones al cliente final.
 */
import type {
  ComparativaEstrategia,
  CrudosData,
  DiaDetalle,
  Estrategia,
  IngresoDesglosado,
  PreciosMercado,
  ResultadoParte2,
  SimResult,
} from "@/types/bess";
import { simularBESS, simularArbitrajeLalo } from "./bess-sim";

// Re-export para que consumidores de Parte 2 importen siempre desde
// "@/lib/estrategia" (los tipos viven en types/bess.ts para evitar
// ciclo con bess-sim.ts).
export type {
  ComparativaEstrategia,
  Estrategia,
  IngresoDesglosado,
  PreciosMercado,
  ResultadoParte2,
};

// ──────────────────────────────────────────────────────────────────
// Constantes de dominio
// ──────────────────────────────────────────────────────────────────

export const PRECIO_ENERGIA_MXN_MWH_DEFAULT = 1010.8;
export const PRECIO_POTENCIA_MXN_MW_MES_DEFAULT = 333_334;
export const PRECIO_CEL_MXN_DEFAULT = 190.0;
export const CELS_POR_MWH = 1.0;
export const HORA_PUNTA_INI = 18;
export const HORA_PUNTA_FIN = 22;
export const PERCENTIL_POTENCIA_FIRME = 80;

// ──────────────────────────────────────────────────────────────────
// Funciones
// ──────────────────────────────────────────────────────────────────

/**
 * Potencia firme garantizable según percentil 80 de la potencia
 * promedio entregada al POI (gen directa + descarga) durante la
 * ventana de hora punta CFE.
 *
 * Lectura: el BESS garantiza entregar al menos este nivel de potencia
 * en al menos `percentil%` de los días del periodo analizado.
 */
export function calcularPotenciaFirmeKW(
  diario: Record<string, DiaDetalle>,
  horaIni: number = HORA_PUNTA_INI,
  horaFin: number = HORA_PUNTA_FIN,
  percentil: number = PERCENTIL_POTENCIA_FIRME,
): number {
  const valoresHP: number[] = [];
  for (const fecha in diario) {
    const dia = diario[fecha];
    let energiaHP = 0;
    let nHoras = 0;
    for (let h = horaIni; h <= horaFin && h < 24; h++) {
      energiaHP += (dia.descarga[h] ?? 0) + (dia.gen[h] ?? 0);
      nHoras++;
    }
    if (nHoras > 0) valoresHP.push(energiaHP / nHoras);
  }
  if (valoresHP.length === 0) return 0;
  valoresHP.sort((a, b) => a - b);
  const idx = Math.floor(((100 - percentil) / 100) * valoresHP.length);
  return valoresHP[Math.max(0, Math.min(valoresHP.length - 1, idx))];
}

/**
 * Ingreso anualizado a partir de una simulación BESS. Tres fuentes:
 *   1. Energía al POI (gen − carga + descarga) × precio PPA
 *   2. Potencia firme × precio × 12 meses
 *   3. CELs (1 por MWh renovable al POI) × precio
 */
export function calcularIngresoAnual(
  sim: SimResult,
  nDiasPeriodo: number,
  precios: PreciosMercado,
): IngresoDesglosado {
  const factorAnualizar = nDiasPeriodo > 0 ? 365 / nDiasPeriodo : 1;

  let energiaTotalKwh = 0;
  for (const fecha in sim.diario) {
    const dia = sim.diario[fecha];
    for (let h = 0; h < 24; h++) {
      const alPoi =
        (dia.gen[h] ?? 0) - (dia.carga[h] ?? 0) + (dia.descarga[h] ?? 0);
      energiaTotalKwh += alPoi;
    }
  }
  const energiaTotalMwhAnual = (energiaTotalKwh / 1000) * factorAnualizar;
  const descargadoMwhAnual = (sim.descargado_kWh / 1000) * factorAnualizar;
  const kwFirme = calcularPotenciaFirmeKW(sim.diario);
  const mwFirme = kwFirme / 1000;

  const ingresoEnergia = energiaTotalMwhAnual * precios.energia_mxn_mwh;
  const ingresoPotencia = mwFirme * precios.potencia_mxn_mw_mes * 12;
  const ingresoCels = energiaTotalMwhAnual * CELS_POR_MWH * precios.cel_mxn;

  return {
    energia_mxn: ingresoEnergia,
    potencia_mxn: ingresoPotencia,
    cels_mxn: ingresoCels,
    total_mxn: ingresoEnergia + ingresoPotencia + ingresoCels,
    kw_firme_garantizable: kwFirme,
    energia_total_mwh_anual: energiaTotalMwhAnual,
    descargado_mwh_anual: descargadoMwhAnual,
  };
}

/**
 * Compara las dos estrategias sobre los mismos crudos y propuesta y
 * decide la ganadora por ingreso anual total.
 */
export function compararEstrategias(
  crudos: CrudosData,
  P_kW: number,
  E_kWh: number,
  DOD_pct: number,
  RTE_pct: number,
  nDiasPeriodo: number,
  precios: PreciosMercado,
): ResultadoParte2 {
  const dod = DOD_pct / 100;
  const rte = RTE_pct / 100;

  const simGreedy = simularBESS(crudos, P_kW, E_kWh, dod, rte);
  const simArbitraje = simularArbitrajeLalo(crudos, P_kW, E_kWh, dod, rte);

  const ingresoGreedy = calcularIngresoAnual(simGreedy, nDiasPeriodo, precios);
  const ingresoArbitraje = calcularIngresoAnual(
    simArbitraje,
    nDiasPeriodo,
    precios,
  );

  const ganadora: Estrategia =
    ingresoArbitraje.total_mxn > ingresoGreedy.total_mxn
      ? "arbitraje"
      : "greedy";

  const ventajaAnual = Math.abs(
    ingresoArbitraje.total_mxn - ingresoGreedy.total_mxn,
  );

  return {
    greedy: { estrategia: "greedy", sim: simGreedy, ingreso: ingresoGreedy },
    arbitraje: {
      estrategia: "arbitraje",
      sim: simArbitraje,
      ingreso: ingresoArbitraje,
    },
    ganadora,
    ventaja_mxn_anual: ventajaAnual,
    precios_usados: precios,
  };
}
