import { describe, it, expect } from "vitest";
import { simularArbitrajeLalo, simularBESS } from "@/lib/bess-sim";
import { compararEstrategias } from "@/lib/estrategia";
import type { CrudosData } from "@/types/bess";

function crudosSinClipping(): CrudosData {
  const data: Array<[string, number, number]> = [];
  const fecha = "2025-06-15";
  const POI_kWh_slot = 500 * (5 / 60);

  for (let h = 0; h < 24; h++) {
    let gen_kW = 0;
    if (h >= 7 && h <= 17) {
      // Curva solar suave, pico ~400 kW (debajo del POI 500)
      gen_kW = 400 * Math.sin(((h - 7) / 10) * Math.PI);
    }
    const gen_kWh_slot = gen_kW * (5 / 60);
    for (let k = 0; k < 12; k++) {
      const ts = `${fecha}T${String(h).padStart(2, "0")}:${String(k * 5).padStart(2, "0")}:00`;
      data.push([ts, gen_kWh_slot, POI_kWh_slot]);
    }
  }

  return {
    meta: {
      columnas: ["ts", "gen", "poi"],
      resolucion_horas: 5 / 60,
      registros: data.length,
    },
    data,
  };
}

describe("simularArbitrajeLalo", () => {
  it("descarga más que greedy cuando no hay clipping", () => {
    const crudos = crudosSinClipping();
    const greedy = simularBESS(crudos, 100, 400, 0.95, 0.85);
    const arbitraje = simularArbitrajeLalo(crudos, 100, 400, 0.95, 0.85);
    expect(arbitraje.descargado_kWh).toBeGreaterThan(greedy.descargado_kWh);
  });

  it("respeta la eficiencia round-trip", () => {
    const crudos = crudosSinClipping();
    const arbitraje = simularArbitrajeLalo(crudos, 100, 400, 0.95, 0.85);
    if (arbitraje.cargado_kWh > 0) {
      const eff = arbitraje.descargado_kWh / arbitraje.cargado_kWh;
      expect(eff).toBeLessThanOrEqual(0.86);
      expect(eff).toBeGreaterThanOrEqual(0.0);
    }
  });

  it("nunca devuelve descargado > cargado * RTE", () => {
    const crudos = crudosSinClipping();
    const arbitraje = simularArbitrajeLalo(crudos, 100, 400, 0.95, 0.85);
    const maxDescargable = arbitraje.cargado_kWh * 0.85;
    expect(arbitraje.descargado_kWh).toBeLessThanOrEqual(maxDescargable + 0.01);
  });
});

describe("compararEstrategias", () => {
  it("identifica al ganador por ingreso total", () => {
    const crudos = crudosSinClipping();
    const precios = {
      energia_mxn_mwh: 1010.8,
      potencia_mxn_mw_mes: 333_334,
      cel_mxn: 190,
    };

    const r = compararEstrategias(crudos, 100, 400, 95, 85, 1, precios);

    const ingresoG = r.greedy.ingreso.total_mxn;
    const ingresoA = r.arbitraje.ingreso.total_mxn;
    const esperado = ingresoA > ingresoG ? "arbitraje" : "greedy";
    expect(r.ganadora).toBe(esperado);
    expect(r.ventaja_mxn_anual).toBeCloseTo(Math.abs(ingresoA - ingresoG), 6);
  });
});
