/**
 * Carga del perfil horario desde archivo Excel tipo Tequila 1.
 *
 * Maneja las idiosincrasias del formato:
 *   - Header decorativo en filas previas (SheetJS puede saltar filas vacías)
 *   - Columna A vacía (SheetJS la colapsa automáticamente)
 *   - Fila "Total general" al final que debe descartarse
 *   - Hora va de 1 a 24 (convención CFE/CENACE, no 0-23)
 *
 * Estrategia de robustez:
 *   - NO asumimos que el header está en una fila fija
 *   - Buscamos la primera fila que contenga las 3 columnas requeridas
 */
import * as XLSX from "xlsx";

export interface PerfilHorario {
  fecha: string;
  hora: number;
  energia_mwh: number;
  timestamp: string;
}

export interface ConfigCarga {
  hojaExcel?: string;
  colFecha?: string;
  colHora?: string;
  colEnergia?: string;
}

const DEFAULTS: Required<ConfigCarga> = {
  hojaExcel: "Hoja1",
  colFecha: "Día de Operación",
  colHora: "Hora",
  colEnergia: "Energía Registrada [MWh]",
};

function excelDateToISO(val: unknown): string | null {
  if (val instanceof Date) {
    const y = val.getUTCFullYear();
    const m = String(val.getUTCMonth() + 1).padStart(2, "0");
    const d = String(val.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof val === "string") {
    const d = new Date(val);
    if (!Number.isNaN(d.getTime())) return excelDateToISO(d);
  }
  return null;
}

function detectarHeader(
  matriz: unknown[][],
  cfg: Required<ConfigCarga>,
): { filaIdx: number; idxFecha: number; idxHora: number; idxEnergia: number } | null {
  for (let i = 0; i < Math.min(matriz.length, 20); i++) {
    const row = matriz[i];
    if (!row || row.length === 0) continue;
    const idxFecha = row.findIndex((c) => c === cfg.colFecha);
    const idxHora = row.findIndex((c) => c === cfg.colHora);
    const idxEnergia = row.findIndex((c) => c === cfg.colEnergia);
    if (idxFecha >= 0 && idxHora >= 0 && idxEnergia >= 0) {
      return { filaIdx: i, idxFecha, idxHora, idxEnergia };
    }
  }
  return null;
}

export function cargarPerfilHorario(
  buffer: ArrayBuffer,
  config: ConfigCarga = {},
): PerfilHorario[] {
  const cfg = { ...DEFAULTS, ...config };
  const workbook = XLSX.read(buffer, {
    type: "array",
    cellDates: true,
    cellNF: false,
  });

  if (!workbook.SheetNames.includes(cfg.hojaExcel)) {
    throw new Error(
      `La hoja "${cfg.hojaExcel}" no existe. Hojas disponibles: ${workbook.SheetNames.join(", ")}`,
    );
  }

  const sheet = workbook.Sheets[cfg.hojaExcel];
  const matriz = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    raw: true,
  });

  const header = detectarHeader(matriz, cfg);
  if (!header) {
    throw new Error(
      `No encontré el header esperado en las primeras 20 filas. ` +
        `Buscaba: "${cfg.colFecha}", "${cfg.colHora}", "${cfg.colEnergia}".`,
    );
  }

  const { filaIdx, idxFecha, idxHora, idxEnergia } = header;
  const filas: PerfilHorario[] = [];

  for (let i = filaIdx + 1; i < matriz.length; i++) {
    const row = matriz[i];
    if (!row || row.length === 0) continue;
    const fechaRaw = row[idxFecha];
    const horaRaw = row[idxHora];
    const energiaRaw = row[idxEnergia];

    const fecha = excelDateToISO(fechaRaw);
    if (!fecha) continue;

    const hora = typeof horaRaw === "number" ? horaRaw : Number(horaRaw);
    if (!Number.isFinite(hora) || hora < 1 || hora > 24) continue;

    const energia =
      typeof energiaRaw === "number" ? energiaRaw : Number(energiaRaw);
    const energia_mwh = Number.isFinite(energia) ? energia : 0;

    const hh = String(Math.floor(hora) - 1).padStart(2, "0");
    const timestamp = `${fecha}T${hh}:00:00`;

    filas.push({
      fecha,
      hora: Math.floor(hora),
      energia_mwh,
      timestamp,
    });
  }

  filas.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return filas;
}

export interface ReporteCalidad {
  filas: number;
  dias: number;
  fechaMin: string;
  fechaMax: string;
  horasEsperadas: number;
  horasPresentes: number;
  gapHoras: number;
  energiaTotalMwh: number;
  picoHorarioKw: number;
  valoresNegativos: number;
}

export function validarPerfil(perfil: PerfilHorario[]): ReporteCalidad {
  if (perfil.length === 0) {
    throw new Error("El perfil está vacío. Revisar el archivo de origen.");
  }
  const fechas = new Set(perfil.map((p) => p.fecha));
  const fechaMin = perfil[0].fecha;
  const fechaMax = perfil[perfil.length - 1].fecha;
  const d1 = new Date(fechaMin + "T00:00:00Z");
  const d2 = new Date(fechaMax + "T00:00:00Z");
  const rangoDias =
    Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const horasEsperadas = rangoDias * 24;
  const horasPresentes = perfil.length;
  const energiaTotal = perfil.reduce((acc, p) => acc + p.energia_mwh, 0);
  const picoHorario = perfil.reduce((m, p) => Math.max(m, p.energia_mwh), 0);
  const negativos = perfil.filter((p) => p.energia_mwh < 0).length;
  return {
    filas: perfil.length,
    dias: fechas.size,
    fechaMin,
    fechaMax,
    horasEsperadas,
    horasPresentes,
    gapHoras: horasEsperadas - horasPresentes,
    energiaTotalMwh: energiaTotal,
    picoHorarioKw: picoHorario * 1000,
    valoresNegativos: negativos,
  };
}
