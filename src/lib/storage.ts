/**
 * Wrapper tipado de localStorage para persistir el análisis del cliente.
 *
 * Estructura del storage:
 *   bess.cliente         → ConfigCliente (POI, capacidad PV, precio PPA, etc.)
 *   bess.propuesta       → PropuestaConsultor (PV adicional, BESS p, BESS e, etc.)
 *   bess.datos_crudos    → CrudosData (serie cincominutal procesada)
 *   bess.datos_resumen   → ResumenData (todas las métricas)
 *   bess.timestamp       → string ISO del último procesamiento
 */
import type { CrudosData, ResumenData } from "@/types/bess";
import type { Diagnostico, Escenario, NivelEscenario } from "./diagnostico";
import type {
  ClippingReal,
  PerfilHorarioPromedio,
  RecursoReal,
  Variabilidad,
} from "./recurso";

const PREFIX = "bess.";

export interface ConfigCliente {
  nombre_planta: string;
  cliente: string;
  ubicacion: string;
  poi_kw: number;
  cap_pv_instalada_kw: number;
  precio_ppa_mxn_mwh: number;
}

export interface PropuestaConsultor {
  pv_adicional_kw: number;
  bess_p_kw: number;
  bess_e_kwh: number;
  dod_pct: number;
  rte_pct: number;
}

export interface ParteUno {
  recurso_real: RecursoReal;
  clipping_real: ClippingReal;
  perfil_horario: PerfilHorarioPromedio;
  variabilidad: Variabilidad;
  diagnostico: Diagnostico;
  escenarios_sugeridos: Record<NivelEscenario, Escenario>;
}

export interface EstadoAnalisis {
  cliente: ConfigCliente;
  propuesta: PropuestaConsultor;
  parte1: ParteUno;
  crudos: CrudosData;
  resumen: ResumenData;
  timestamp: string;
}

function get<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function set<T>(key: string, value: T): boolean {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error("localStorage set falló:", e);
    return false;
  }
}

function del(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    /* noop */
  }
}

export const storage = {
  guardarAnalisis(estado: EstadoAnalisis): boolean {
    const ok1 = set("cliente", estado.cliente);
    const ok2 = set("propuesta", estado.propuesta);
    const ok3 = set("parte1", estado.parte1);
    const ok4 = set("datos_crudos", estado.crudos);
    const ok5 = set("datos_resumen", estado.resumen);
    const ok6 = set("timestamp", estado.timestamp);
    return ok1 && ok2 && ok3 && ok4 && ok5 && ok6;
  },

  cargarAnalisis(): EstadoAnalisis | null {
    const cliente = get<ConfigCliente>("cliente");
    const propuesta = get<PropuestaConsultor>("propuesta");
    const parte1 = get<ParteUno>("parte1");
    const crudos = get<CrudosData>("datos_crudos");
    const resumen = get<ResumenData>("datos_resumen");
    const timestamp = get<string>("timestamp");
    if (!cliente || !propuesta || !parte1 || !crudos || !resumen || !timestamp) {
      return null;
    }
    return { cliente, propuesta, parte1, crudos, resumen, timestamp };
  },

  guardarPropuesta(prop: PropuestaConsultor): boolean {
    return set("propuesta", prop);
  },

  guardarResumen(resumen: ResumenData): boolean {
    return set("datos_resumen", resumen);
  },

  guardarCrudos(crudos: CrudosData): boolean {
    return set("datos_crudos", crudos);
  },

  borrarTodo(): void {
    del("cliente");
    del("propuesta");
    del("parte1");
    del("datos_crudos");
    del("datos_resumen");
    del("timestamp");
  },

  hayAnalisis(): boolean {
    return localStorage.getItem(PREFIX + "cliente") !== null;
  },
};
