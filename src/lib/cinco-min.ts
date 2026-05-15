/**
 * Reconstrucción cincominutal sintética con escalado PV/POI.
 *
 * Réplica de reconstruir_cincominutal() del Colab.
 * Réplica de construir_datos_resumen() del Colab.
 *
 * Estos son los procesos que generan datos_crudos.json y datos_resumen.json
 * que la app consume desde public/.
 */
import type { PerfilHorario } from "./data-loader";
import type {
  CrudosData,
  ResumenData,
  SimulacionPre,
  DiasDetalle,
} from "@/types/bess";
import { simularBESS } from "./bess-sim";
import { quantile, round } from "./recurso";

/* ============================================================================
 * Reconstrucción cincominutal
 * ========================================================================== */

export interface Cincominutal {
  timestamp: string;
  gen_kwh: number;
  poi_kwh: number;
  fecha: string;
  hora: number;
}

/**
 * Reconstruye la serie cincominutal a partir del perfil horario.
 *
 * Cada hora con energía Registrada E_h se convierte en:
 *   - PV bruta horaria escalada: E_bruta_h = E_h × (CAP_PV_TOTAL / POI)
 *   - Distribución plana: cada intervalo de 5min recibe E_bruta_h / 12
 *
 * Techo del POI por intervalo: POI × (5/60) kWh.
 */
export function reconstruirCincominutal(
  perfil: PerfilHorario[],
  capPvTotalKw: number,
  poiKw: number,
): Cincominutal[] {
  const factor = capPvTotalKw / poiKw;
  const poi_kwh_5min = poiKw * (5 / 60);

  const out: Cincominutal[] = [];
  for (const p of perfil) {
    const gen_bruta_5min_kwh = (p.energia_mwh * factor * 1000) / 12;
    const tsBase = new Date(p.timestamp + "Z"); // tratar como UTC para evitar TZ
    for (let k = 0; k < 12; k++) {
      const ts = new Date(tsBase.getTime() + k * 5 * 60 * 1000);
      const iso = ts.toISOString().slice(0, 19);
      out.push({
        timestamp: iso,
        gen_kwh: gen_bruta_5min_kwh,
        poi_kwh: poi_kwh_5min,
        fecha: iso.slice(0, 10),
        hora: parseInt(iso.slice(11, 13), 10),
      });
    }
  }
  return out;
}

/* ============================================================================
 * Construcción de datos_crudos.json
 * ========================================================================== */

export function construirDatosCrudos(cincominutal: Cincominutal[]): CrudosData {
  const DT_H = 5 / 60;
  return {
    meta: {
      columnas: ["datetime", "gen_est_kWh", "POI_kWh"],
      resolucion_horas: DT_H,
      registros: cincominutal.length,
    },
    data: cincominutal.map((r) => [
      r.timestamp,
      round(r.gen_kwh, 4),
      round(r.poi_kwh, 4),
    ]),
  };
}

/* ============================================================================
 * Construcción de datos_resumen.json
 * ========================================================================== */

export interface ContextoResumen {
  sitio: string;
  ubicacion: string;
  capPvTotalKw: number;
  poiKw: number;
  bess: {
    P_kW: number;
    E_kWh: number;
    DOD_pct: number;
    RTE_pct: number;
  };
  precioMxnMwh: number;
  /** Resultados de Parte 1 que se incrustan en el JSON */
  parte1?: {
    recurso_real: unknown;
    clipping_real: unknown;
    variabilidad: unknown;
    diagnostico: unknown;
    escenarios_sugeridos: unknown;
    perfil_horario_real: unknown;
  };
}

const PARETO_POTENCIAS_KW = [
  100, 150, 200, 250, 275, 300, 350, 375, 400, 438, 500, 600,
];
const PARETO_DURACION_H = 4;
const CICLOS_EOL_LFP = 6000;
const VIDA_MAX_ANOS = 20;

export function construirDatosResumen(
  cincominutal: Cincominutal[],
  ctx: ContextoResumen,
): ResumenData {
  const DT_H = 5 / 60;
  const { bess, capPvTotalKw, poiKw, precioMxnMwh } = ctx;

  // Métricas del recurso del escenario propuesto (con escalado)
  let pv_bruta_kwh = 0;
  let al_poi_kwh = 0;
  let pico_5min = 0;
  for (const r of cincominutal) {
    pv_bruta_kwh += r.gen_kwh;
    al_poi_kwh += Math.min(r.gen_kwh, r.poi_kwh);
    if (r.gen_kwh > pico_5min) pico_5min = r.gen_kwh;
  }
  const pv_bruta = pv_bruta_kwh / 1000;
  const al_poi = al_poi_kwh / 1000;
  const clip = pv_bruta - al_poi;
  const pico_kw = pico_5min / DT_H;
  const horas_total = cincominutal.length * DT_H;
  const fechas_set = new Set(cincominutal.map((r) => r.fecha));
  const dias = fechas_set.size;

  // Estadísticos del excedente
  const excedentes_kW: number[] = [];
  const por_dia = new Map<string, number>();
  for (const r of cincominutal) {
    const ex_kwh = Math.max(0, r.gen_kwh - r.poi_kwh);
    if (ex_kwh > 0) excedentes_kW.push(ex_kwh / DT_H);
    por_dia.set(r.fecha, (por_dia.get(r.fecha) ?? 0) + ex_kwh);
  }
  const positivos_dia = Array.from(por_dia.values()).filter((v) => v > 0);

  // Perfil horario para la app (hora 0-23)
  const perfil_h_map = new Map<
    number,
    { gen_sum: number; gen_max: number; ex_sum: number; ex_max: number; n: number }
  >();
  for (let h = 0; h < 24; h++) {
    perfil_h_map.set(h, { gen_sum: 0, gen_max: 0, ex_sum: 0, ex_max: 0, n: 0 });
  }
  for (const r of cincominutal) {
    const acc = perfil_h_map.get(r.hora);
    if (!acc) continue;
    const gen_kW = r.gen_kwh / DT_H;
    const ex_kW = Math.max(0, r.gen_kwh - r.poi_kwh) / DT_H;
    acc.gen_sum += gen_kW;
    acc.gen_max = Math.max(acc.gen_max, gen_kW);
    acc.ex_sum += ex_kW;
    acc.ex_max = Math.max(acc.ex_max, ex_kW);
    acc.n++;
  }
  const perfil_horario_app = [];
  for (let h = 0; h < 24; h++) {
    const acc = perfil_h_map.get(h)!;
    perfil_horario_app.push({
      hora: h,
      gen_kW_avg: round(acc.n > 0 ? acc.gen_sum / acc.n : 0, 2),
      gen_kW_max: round(acc.gen_max, 2),
      excedente_kW_avg: round(acc.n > 0 ? acc.ex_sum / acc.n : 0, 2),
      excedente_kW_max: round(acc.ex_max, 2),
    });
  }

  // Excedente diario
  const exc_diario_list = [];
  let dia_num = 0;
  const fechas_ordenadas = Array.from(fechas_set).sort();
  for (const fecha of fechas_ordenadas) {
    dia_num++;
    const records = cincominutal.filter((r) => r.fecha === fecha);
    let ex_sum = 0;
    let ex_max_kW = 0;
    let gen_sum_kwh = 0;
    let h_ini: number | null = null;
    let h_fin: number | null = null;
    for (const r of records) {
      const ex_kwh = Math.max(0, r.gen_kwh - r.poi_kwh);
      ex_sum += ex_kwh;
      gen_sum_kwh += r.gen_kwh;
      const ex_kW = ex_kwh / DT_H;
      if (ex_kW > ex_max_kW) ex_max_kW = ex_kW;
      if (ex_kW > 0) {
        const min_decimal =
          parseInt(r.timestamp.slice(14, 16), 10) / 60;
        const hora_dec = r.hora + min_decimal;
        if (h_ini === null || hora_dec < h_ini) h_ini = hora_dec;
        if (h_fin === null || hora_dec > h_fin) h_fin = hora_dec;
      }
    }
    exc_diario_list.push({
      fecha,
      dia: dia_num,
      excedente_kWh: round(ex_sum, 2),
      pico_kW: round(ex_max_kW, 2),
      h_inicio: round(h_ini ?? 0, 2),
      h_fin: round(h_fin ?? 0, 2),
      duracion_h: round((h_fin ?? 0) - (h_ini ?? 0), 2),
      gen_PV_kWh: round(gen_sum_kwh, 2),
    });
  }

  // Simulaciones de la pestaña Decisión
  const sims_cfg = {
    subdimensionada: { P_kW: 250, E_kWh: 1000, nombre: "Subdimensionada" },
    conservadora: { P_kW: 300, E_kWh: 1200, nombre: "Conservadora" },
    recomendada: {
      P_kW: bess.P_kW,
      E_kWh: bess.E_kWh,
      nombre: "Recomendada",
    },
    sobredimensionada: { P_kW: 500, E_kWh: 2000, nombre: "Sobredimensionada" },
  };

  const crudos_para_sim: CrudosData = {
    meta: {
      columnas: ["datetime", "gen_est_kWh", "POI_kWh"],
      resolucion_horas: DT_H,
      registros: cincominutal.length,
    },
    data: cincominutal.map((r) => [r.timestamp, r.gen_kwh, r.poi_kwh]),
  };

  const simulaciones: Record<string, SimulacionPre | DiasDetalle> = {};
  for (const [key, cfg] of Object.entries(sims_cfg)) {
    const sim = simularBESS(
      crudos_para_sim,
      cfg.P_kW,
      cfg.E_kWh,
      bess.DOD_pct / 100,
      bess.RTE_pct / 100,
    );
    const cap_util = cfg.E_kWh * (bess.DOD_pct / 100);
    const ciclos_mes = cap_util > 0 ? sim.descargado_kWh / cap_util : 0;
    const ciclos_ano = dias > 0 ? ciclos_mes * (365 / dias) : ciclos_mes * 12;
    const vida_anos =
      ciclos_ano > 0
        ? Math.min(VIDA_MAX_ANOS, CICLOS_EOL_LFP / ciclos_ano)
        : 0;

    simulaciones[key] = {
      nombre: cfg.nombre,
      P_kW: cfg.P_kW,
      E_kWh: cfg.E_kWh,
      horas: cfg.E_kWh / cfg.P_kW,
      cargado_kWh: round(sim.cargado_kWh, 2),
      descargado_kWh: round(sim.descargado_kWh, 2),
      perdido_kWh: round(sim.perdido_kWh, 2),
      pct_capturado: round(sim.pct_capturado, 2),
      soc_max_kWh: round(sim.soc_max_kWh, 2),
      utilizacion_pct: round((100 * sim.soc_max_kWh) / cfg.E_kWh, 2),
      dias_saturado: sim.dias_saturado,
      h_carga_promedio: 0,
      h_desc_promedio: 0,
      ciclos_mes: round(ciclos_mes, 2),
      ciclos_ano: round(ciclos_ano, 1),
      vida_util_anos: round(vida_anos, 1),
      energia_extra_MWh_mes: round(sim.descargado_kWh / 1000, 2),
      valor_extra_MXN_mes: round(
        sim.descargado_kWh * (precioMxnMwh / 1000),
        0,
      ),
    };
  }

  // Simulación principal para los días_detalle
  const sim_principal = simularBESS(
    crudos_para_sim,
    bess.P_kW,
    bess.E_kWh,
    bess.DOD_pct / 100,
    bess.RTE_pct / 100,
  );
  simulaciones.dias_detalle = sim_principal.diario;

  // Pareto
  const pareto = PARETO_POTENCIAS_KW.map((p) => {
    const e = p * PARETO_DURACION_H;
    const sim = simularBESS(
      crudos_para_sim,
      p,
      e,
      bess.DOD_pct / 100,
      bess.RTE_pct / 100,
    );
    return {
      P_kW: p,
      E_kWh: e,
      pct_capturado: round(sim.pct_capturado, 2),
      cargado_kWh: round(sim.cargado_kWh, 2),
      perdido_kWh: round(sim.perdido_kWh, 2),
    };
  });

  const factor_planta_pct =
    capPvTotalKw > 0 && horas_total > 0
      ? ((pv_bruta * 1000) / (capPvTotalKw * horas_total)) * 100
      : 0;
  const horas_sol_dia =
    capPvTotalKw > 0 && dias > 0
      ? (pv_bruta * 1000) / capPvTotalKw / dias
      : 0;

  const ts0 = cincominutal[0]?.timestamp ?? "";
  const tsN = cincominutal[cincominutal.length - 1]?.timestamp ?? "";

  const resumen: ResumenData = {
    meta: {
      sitio: ctx.sitio,
      ubicacion: ctx.ubicacion,
      periodo_analizado: `${ts0.slice(0, 10)} a ${tsN.slice(0, 10)}`,
      resolucion_minutos: 5,
      registros_totales: cincominutal.length,
      dias_analizados: dias,
      fecha_inicio: ts0.slice(0, 10),
      fecha_fin: tsN.slice(0, 10),
    },
    recurso_pv: {
      energia_pv_bruta_MWh: round(pv_bruta, 4),
      energia_al_poi_MWh: round(al_poi, 4),
      curtailment_MWh: round(clip, 4),
      curtailment_pct: pv_bruta > 0 ? round((clip / pv_bruta) * 100, 2) : 0,
      pico_pv_kW: round(pico_kw, 2),
      POI_kW: poiKw,
      cap_pv_total_kW: capPvTotalKw,
      factor_planta_pct: round(factor_planta_pct, 2),
      horas_sol_diarias_promedio: round(horas_sol_dia, 2),
    },
    estadisticos_excedente: {
      pico_kW:
        excedentes_kW.length > 0 ? round(Math.max(...excedentes_kW), 2) : 0,
      p99_kW:
        excedentes_kW.length > 0 ? round(quantile(excedentes_kW, 0.99), 2) : 0,
      p95_kW:
        excedentes_kW.length > 0 ? round(quantile(excedentes_kW, 0.95), 2) : 0,
      p90_kW:
        excedentes_kW.length > 0 ? round(quantile(excedentes_kW, 0.9), 2) : 0,
      promedio_kW_cuando_hay:
        excedentes_kW.length > 0
          ? round(
              excedentes_kW.reduce((a, b) => a + b, 0) / excedentes_kW.length,
              2,
            )
          : 0,
      diario_promedio_kWh:
        positivos_dia.length > 0
          ? round(
              positivos_dia.reduce((a, b) => a + b, 0) / positivos_dia.length *
                1000,
              2,
            )
          : 0,
      diario_mediana_kWh:
        positivos_dia.length > 0
          ? round(quantile(positivos_dia, 0.5) * 1000, 2)
          : 0,
      diario_p90_kWh:
        positivos_dia.length > 0
          ? round(quantile(positivos_dia, 0.9) * 1000, 2)
          : 0,
      diario_max_kWh:
        positivos_dia.length > 0
          ? round(Math.max(...positivos_dia) * 1000, 2)
          : 0,
      diario_min_kWh:
        positivos_dia.length > 0
          ? round(Math.min(...positivos_dia) * 1000, 2)
          : 0,
      duracion_promedio_h: 0,
      h_inicio_promedio: 0,
      h_fin_promedio: 0,
    },
    excedente_diario: exc_diario_list,
    perfil_horario: perfil_horario_app,
    simulaciones: simulaciones as ResumenData["simulaciones"],
    pareto,
    recomendacion: {
      P_kW: bess.P_kW,
      E_kWh: bess.E_kWh,
      horas: bess.E_kWh / bess.P_kW,
      tecnologia: "LFP",
      DOD_pct: bess.DOD_pct,
      RTE_pct: bess.RTE_pct,
    },
  };

  // Si vienen datos de Parte 1, los anidamos (como propiedad extra)
  if (ctx.parte1) {
    (resumen as ResumenData & { parte1: unknown }).parte1 = ctx.parte1;
  }

  return resumen;
}
