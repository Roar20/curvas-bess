import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "fs";
import { cargarPerfilHorario, validarPerfil } from "@/lib/data-loader";
import {
  caracterizarRecursoReal,
  detectarClippingReal,
  calcularPerfilHorario,
  caracterizarVariabilidadDiaria,
} from "@/lib/recurso";
import {
  diagnosticarOportunidad,
  generarEscenariosPropuesta,
} from "@/lib/diagnostico";
import { reconstruirCincominutal } from "@/lib/cinco-min";
import { simularBESS } from "@/lib/bess-sim";
import type { CrudosData } from "@/types/bess";

/**
 * Test de paridad TypeScript vs Colab.
 *
 * Estos targets vienen del Colab corrido con el archivo
 * REPORTE_ESTANZUELA_2_MAR_2026.xlsx. La tolerancia es <0.5% en todas las
 * métricas. Si este test falla después de un cambio, significa que el motor
 * de la app se desvió del Colab y hay que investigar.
 *
 * Para correr este test, coloca el archivo Excel en
 *   tests/fixtures/REPORTE_ESTANZUELA_2_MAR_2026.xlsx
 *
 * Si el archivo no está presente, el test se salta automáticamente.
 */

const FIXTURE_PATH = "src/test/fixtures/REPORTE_ESTANZUELA_2_MAR_2026.xlsx";
const fixtureExists = existsSync(FIXTURE_PATH);

const TARGETS = {
  energia_pv_bruta_MWh: 195.0,
  energia_al_poi_MWh: 146.9,
  curtailment_MWh: 48.1,
  pico_pv_kW: 763.0,
  pct_capturado_400_1600: 95.2,
  pct_capturado_250_1000: 64.9,
  pct_capturado_500_2000: 100.0,
};

const TOLERANCIA_PCT = 0.5;

describe("Paridad TS vs Colab — Estanzuela 2 marzo 2026", () => {
  it.skipIf(!fixtureExists)("debe reproducir las cifras del Colab", () => {
    const buf = readFileSync(FIXTURE_PATH);
    const ab = buf.buffer.slice(
      buf.byteOffset,
      buf.byteOffset + buf.byteLength,
    );

    const perfil = cargarPerfilHorario(ab);
    expect(perfil.length).toBeGreaterThan(0);

    const POI = 500;
    const CAP_INST = 500;
    const PV_TOTAL = 900; // overbuild 400

    // --- Validar Parte 1 ---
    const recurso = caracterizarRecursoReal(perfil, POI, CAP_INST);
    expect(recurso.pico_kw).toBeCloseTo(424.14, 1);
    expect(recurso.factor_planta_pct).toBeCloseTo(29.13, 1);

    const clipping = detectarClippingReal(perfil, POI);
    expect(clipping.hay_clipping_real).toBe(false);

    const perfilH = calcularPerfilHorario(perfil);
    expect(perfilH.hora_pico).toBe(11);

    const variab = caracterizarVariabilidadDiaria(perfil);
    expect(variab.dia_mejor_fecha).toBe("2026-03-31");
    expect(variab.dia_peor_fecha).toBe("2026-03-30");

    const diag = diagnosticarOportunidad(recurso, clipping, perfilH);
    expect(diag.sugerencia_arquitectura).toBe("B");

    const escenarios = generarEscenariosPropuesta(perfil, diag, recurso, {
      poi_kw: POI,
      cap_pv_instalada_kw: CAP_INST,
    });
    expect(escenarios.balanceado.pv_adicional_kw).toBe(350);
    expect(escenarios.agresivo.pv_adicional_kw).toBe(500);

    // --- Validar Parte 2 ---
    const cincominutal = reconstruirCincominutal(perfil, PV_TOTAL, POI);
    const crudos: CrudosData = {
      meta: {
        columnas: ["datetime", "gen_est_kWh", "POI_kWh"],
        resolucion_horas: 5 / 60,
        registros: cincominutal.length,
      },
      data: cincominutal.map(
        (r) => [r.timestamp, r.gen_kwh, r.poi_kwh] as [string, number, number],
      ),
    };

    // Sumar PV bruta, Al POI, Curtailment
    let pv = 0;
    let poi_e = 0;
    for (const r of cincominutal) {
      pv += r.gen_kwh;
      poi_e += Math.min(r.gen_kwh, r.poi_kwh);
    }
    const pv_mwh = pv / 1000;
    const poi_mwh = poi_e / 1000;
    const clip_mwh = pv_mwh - poi_mwh;

    expectWithinTolerance(pv_mwh, TARGETS.energia_pv_bruta_MWh, "PV bruta");
    expectWithinTolerance(poi_mwh, TARGETS.energia_al_poi_MWh, "Al POI");
    expectWithinTolerance(clip_mwh, TARGETS.curtailment_MWh, "Curtailment");

    // Simulaciones BESS
    const sim400 = simularBESS(crudos, 400, 1600, 0.95, 0.85);
    const sim250 = simularBESS(crudos, 250, 1000, 0.95, 0.85);
    const sim500 = simularBESS(crudos, 500, 2000, 0.95, 0.85);

    expectWithinTolerance(
      sim400.pct_capturado,
      TARGETS.pct_capturado_400_1600,
      "% capt 400/1600",
    );
    expectWithinTolerance(
      sim250.pct_capturado,
      TARGETS.pct_capturado_250_1000,
      "% capt 250/1000",
    );
    expectWithinTolerance(
      sim500.pct_capturado,
      TARGETS.pct_capturado_500_2000,
      "% capt 500/2000",
    );
  });

  it("loader rechaza archivo vacío", () => {
    expect(() => {
      const empty = new ArrayBuffer(0);
      cargarPerfilHorario(empty);
    }).toThrow();
  });

  it("validarPerfil cuenta correctamente", () => {
    if (!fixtureExists) return;
    const buf = readFileSync(FIXTURE_PATH);
    const ab = buf.buffer.slice(
      buf.byteOffset,
      buf.byteOffset + buf.byteLength,
    );
    const perfil = cargarPerfilHorario(ab);
    const reporte = validarPerfil(perfil);
    expect(reporte.dias).toBe(31);
    expect(reporte.energiaTotalMwh).toBeCloseTo(108.38, 1);
  });
});

function expectWithinTolerance(actual: number, target: number, label: string) {
  const delta_pct = Math.abs((actual - target) / target) * 100;
  if (delta_pct >= TOLERANCIA_PCT) {
    throw new Error(
      `${label}: actual=${actual.toFixed(4)} target=${target} Δ=${delta_pct.toFixed(3)}% (tolerancia ${TOLERANCIA_PCT}%)`,
    );
  }
}
