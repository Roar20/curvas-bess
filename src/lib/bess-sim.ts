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
 * Simulación BESS sobre serie cincominutal greedy.
 *
 * Convención de unidades en `crudos.data`:
 *   - timestamp: ISO string
 *   - gen: kWh por intervalo de 5 min (NO kW)
 *   - poi: kWh por intervalo de 5 min (techo, NO kW)
 *
 * Convención de unidades en `diario[fecha]`:
 *   - gen[hora]: suma de los 12 intervalos de esa hora, en kWh
 *   - excedente[hora]: kWh sobre el POI en esa hora
 *   - carga[hora]: kWh cargados al BESS en esa hora
 *   - descarga[hora]: kWh descargados al POI en esa hora (AC)
 *   - soc[hora]: estado de carga en kWh al final del último intervalo de la hora
 *   - perdido[hora]: kWh de excedente no capturados por límites de P o E
 *
 * @param crudos serie cincominutal (con gen y poi en kWh por slot)
 * @param P_kW potencia AC del BESS
 * @param E_kWh capacidad nominal del BESS
 * @param DOD fracción de profundidad de descarga (0-1, default 0.95)
 * @param RTE_total round-trip total carga × descarga (0-1, default 0.85)
 * @returns SimResult con totales del periodo + estructura diaria
 */
export function simularBESS(
  crudos: CrudosData,
  P_kW: number,
  E_kWh: number,
  DOD = 0.95,
  RTE_total = 0.85
): SimResult {
  const eff = Math.sqrt(RTE_total); // por etapa
  const RTE_carga = eff;
  const RTE_desc = eff;
  const DT_H = crudos.meta.resolucion_horas; // 5 min => 0.0833
  const soc_max = E_kWh * DOD;
  const P_int = P_kW * DT_H;

  let soc = 0;
  let cargado = 0,
    descargado = 0,
    perdido = 0;
  let soc_max_obs = 0;

  // Agregación por (fecha, hora)
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
    let carga = 0,
      desc = 0;

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
    d.gen[hora] += gen;
    d.excedente[hora] += excedente;
    d.carga[hora] += carga;
    d.descarga[hora] += desc;
    d.perdido[hora] += Math.max(0, excedente - carga);
    // SOC al final del intervalo: tomamos el último valor de la hora
    d.soc[hora] = soc;
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