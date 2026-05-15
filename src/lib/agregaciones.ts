import {
  parseISO,
  getISOWeek,
  getISOWeekYear,
  getMonth,
  getQuarter,
  getYear,
} from "date-fns";

export type Granularidad =
  | "dia"
  | "semana"
  | "mes"
  | "trimestre"
  | "semestre"
  | "anio";

export type Bucket = {
  etiqueta: string;
  fechaInicio: string;
  fechaFin: string;
  excedente_kWh: number;
  pico_kW: number;
  gen_PV_kWh: number;
  dias_con_excedente: number;
  dias_totales: number;
  mejor_dia: { fecha: string; excedente_kWh: number };
  peor_dia: { fecha: string; excedente_kWh: number };
};

export type DiarioInput = {
  fecha: string;
  excedente_kWh: number;
  pico_kW: number;
  gen_PV_kWh: number;
};

const MESES_3 = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

const ORDEN: Granularidad[] = [
  "dia",
  "semana",
  "mes",
  "trimestre",
  "semestre",
  "anio",
];

export const ETIQUETA_GRAN: Record<Granularidad, string> = {
  dia: "Día",
  semana: "Semana",
  mes: "Mes",
  trimestre: "Trimestre",
  semestre: "Semestre",
  anio: "Año",
};

export const PLURAL_GRAN: Record<Granularidad, string> = {
  dia: "días",
  semana: "semanas",
  mes: "meses",
  trimestre: "trimestres",
  semestre: "semestres",
  anio: "años",
};

export const ARTICULO_PLURAL_GRAN: Record<Granularidad, string> = {
  dia: "los",
  semana: "las",
  mes: "los",
  trimestre: "los",
  semestre: "los",
  anio: "los",
};

export function granularidadesDisponibles(dias: number): Granularidad[] {
  if (dias < 14) return ["dia"];
  if (dias < 60) return ["dia", "semana"];
  if (dias < 100) return ["dia", "semana", "mes"];
  if (dias < 180) return ["dia", "semana", "mes", "trimestre"];
  if (dias < 330) return ["dia", "semana", "mes", "trimestre", "semestre"];
  return ORDEN.slice();
}

export function granularidadDefault(dias: number): Granularidad {
  if (dias <= 35) return "dia";
  if (dias <= 90) return "semana";
  if (dias <= 365) return "mes";
  return "trimestre";
}

function identificador(
  date: Date,
  gran: Granularidad,
): { key: string; etiqueta: string } {
  switch (gran) {
    case "dia": {
      const iso = date.toISOString().slice(0, 10);
      return { key: iso, etiqueta: iso };
    }
    case "semana": {
      const w = getISOWeek(date);
      const wy = getISOWeekYear(date);
      return {
        key: `${wy}-W${String(w).padStart(2, "0")}`,
        etiqueta: `Sem ${w}`,
      };
    }
    case "mes": {
      const y = getYear(date);
      const m = getMonth(date);
      return {
        key: `${y}-${String(m).padStart(2, "0")}`,
        etiqueta: `${MESES_3[m]} ${y}`,
      };
    }
    case "trimestre": {
      const y = getYear(date);
      const q = getQuarter(date);
      return { key: `${y}-Q${q}`, etiqueta: `Q${q} ${y}` };
    }
    case "semestre": {
      const y = getYear(date);
      const s = getMonth(date) < 6 ? 1 : 2;
      return { key: `${y}-S${s}`, etiqueta: `S${s} ${y}` };
    }
    case "anio": {
      const y = getYear(date);
      return { key: `${y}`, etiqueta: `${y}` };
    }
  }
}

export function agregarPorGranularidad(
  diarios: DiarioInput[],
  gran: Granularidad,
): Bucket[] {
  if (diarios.length === 0) return [];

  type Grupo = {
    key: string;
    etiqueta: string;
    items: DiarioInput[];
  };

  const grupos = new Map<string, Grupo>();

  for (const d of diarios) {
    const date = parseISO(d.fecha);
    const { key, etiqueta } = identificador(date, gran);
    let g = grupos.get(key);
    if (!g) {
      g = { key, etiqueta, items: [] };
      grupos.set(key, g);
    }
    g.items.push(d);
  }

  const buckets: Bucket[] = [];
  for (const g of grupos.values()) {
    g.items.sort((a, b) => a.fecha.localeCompare(b.fecha));
    const fechaInicio = g.items[0].fecha;
    const fechaFin = g.items[g.items.length - 1].fecha;

    let exc = 0;
    let pv = 0;
    let picoMax = 0;
    let dias_con_excedente = 0;
    let mejor: DiarioInput = g.items[0];
    let peor: DiarioInput | null = null;

    for (const it of g.items) {
      exc += it.excedente_kWh;
      pv += it.gen_PV_kWh;
      if (it.pico_kW > picoMax) picoMax = it.pico_kW;
      if (it.excedente_kWh > mejor.excedente_kWh) mejor = it;
      if (it.excedente_kWh > 0) {
        dias_con_excedente++;
        if (!peor || it.excedente_kWh < peor.excedente_kWh) peor = it;
      }
    }

    buckets.push({
      etiqueta: g.etiqueta,
      fechaInicio,
      fechaFin,
      excedente_kWh: exc,
      pico_kW: picoMax,
      gen_PV_kWh: pv,
      dias_con_excedente,
      dias_totales: g.items.length,
      mejor_dia: { fecha: mejor.fecha, excedente_kWh: mejor.excedente_kWh },
      peor_dia: peor
        ? { fecha: peor.fecha, excedente_kWh: peor.excedente_kWh }
        : { fecha: "—", excedente_kWh: 0 },
    });
  }

  buckets.sort((a, b) => a.fechaInicio.localeCompare(b.fechaInicio));
  return buckets;
}
