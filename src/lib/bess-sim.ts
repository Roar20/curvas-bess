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

/**
 * Simulación BESS con estrategia de arbitraje horario ("Lalo").
 *
 * Misma firma que `simularBESS()`. Diferencia en la operación:
 *
 *   - En ventana de hora punta CFE [HORA_PUNTA_INI, HORA_PUNTA_FIN]
 *     (18-22h inclusive), descarga al POI con el espacio disponible
 *     (techo - gen). No carga durante hora punta.
 *
 *   - Fuera de hora punta:
 *       (a) Carga clipping (excedente sobre techo) — sin costo de
 *           oportunidad porque esa energía se perdería de todas formas.
 *       (b) Si queda espacio en SOC y potencia AC, carga con energía
 *           generable bajo techo — esto es el arbitraje propiamente:
 *           sacrifica venta inmediata para tener energía disponible en
 *           hora punta donde el precio compuesto (energía + potencia
 *           firme + CELs) es mayor.
 *       (c) Pre-descarga escalonada: si SOC ≥ 85% del nominal útil y
 *           hay déficit en POI (gen < techo), descarga proporcional al
 *           déficit. Evita llegar saturado a hora punta.
 *
 * `perdido_kWh` mantiene la semántica original: kWh de clipping NO
 * capturados. La energía desviada del POI al BESS no se considera
 * perdida (regresa vía descarga con factor RTE).
 */
export function simularArbitrajeLalo(
  crudos: CrudosData,
  P_kW: number,
  E_kWh: number,
  DOD = 0.95,
  RTE_total = 0.85,
): SimResult {
  const HORA_PUNTA_INI = 18;
  const HORA_PUNTA_FIN = 22;
  const UMBRAL_SOC_PREDESCARGA = 0.85;

  const eff = Math.sqrt(RTE_total);
  const RTE_carga = eff;
  const RTE_desc = eff;
  const DT_H = crudos.meta.resolucion_horas;
  const soc_max = E_kWh * DOD;
  const P_int = P_kW * DT_H;

  let soc = 0;
  let cargado = 0;
  let descargado = 0;
  let perdido = 0;
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
    let carga = 0;
    let desc = 0;

    const enHoraPunta = hora >= HORA_PUNTA_INI && hora <= HORA_PUNTA_FIN;

    if (enHoraPunta) {
      if (soc > 0) {
        const desc_dc = Math.min(soc, P_int / RTE_desc);
        const desc_ac = desc_dc * RTE_desc;
        const espacio_poi = Math.max(0, techo - gen);
        desc = Math.min(desc_ac, espacio_poi);
        if (desc > 0) {
          soc -= desc / RTE_desc;
          if (soc < 0) soc = 0;
          descargado += desc;
        }
      }
    } else {
      // (a) Carga con clipping primero (sin costo de oportunidad).
      if (excedente > 0) {
        const espacio = (soc_max - soc) / RTE_carga;
        const c1 = Math.min(excedente, P_int, Math.max(0, espacio));
        soc += c1 * RTE_carga;
        perdido += excedente - c1;
        cargado += c1;
        carga = c1;
      }

      // (b) Si queda espacio y P_int disponible, cargar con generable.
      const espacio_restante = (soc_max - soc) / RTE_carga;
      const p_disponible = P_int - carga;
      if (espacio_restante > 0 && p_disponible > 0) {
        const gen_disponible = Math.min(gen - excedente, techo);
        const c2 = Math.min(
          gen_disponible,
          p_disponible,
          Math.max(0, espacio_restante),
        );
        if (c2 > 0) {
          soc += c2 * RTE_carga;
          cargado += c2;
          carga += c2;
        }
      }

      // (c) Pre-descarga escalonada si SOC alto antes de hora punta.
      const soc_frac = soc_max > 0 ? soc / soc_max : 0;
      if (soc_frac >= UMBRAL_SOC_PREDESCARGA && deficit > 0) {
        const desc_dc = Math.min(soc, P_int / RTE_desc);
        const desc_ac = desc_dc * RTE_desc;
        desc = Math.min(desc_ac, deficit);
        if (desc > 0) {
          soc -= desc / RTE_desc;
          if (soc < 0) soc = 0;
          descargado += desc;
        }
      }
    }

    if (soc > soc_max_obs) soc_max_obs = soc;
    if (soc > dailySocMax[fecha]) dailySocMax[fecha] = soc;

    const d = diario[fecha];
    d.gen[hora] += gen;
    d.excedente[hora] += excedente;
    d.carga[hora] += carga;
    d.descarga[hora] += desc;
    d.perdido[hora] += Math.max(0, excedente - carga);
    d.soc[hora] = soc;
  }

  let excedente_total = 0;
  for (const [, g, t] of crudos.data) excedente_total += Math.max(0, g - t);

  let dias_saturado = 0;
  for (const f in dailySocMax) {
    if (dailySocMax[f] >= soc_max * 0.9) dias_saturado++;
  }

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