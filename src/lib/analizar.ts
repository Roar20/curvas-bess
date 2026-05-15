/**
 * Orquestador de alto nivel: del archivo Excel a un análisis completo.
 *
 * Esta es la función que el componente Onboarding llama después de que el
 * usuario sube el archivo y mete los parámetros del cliente.
 */
import { cargarPerfilHorario, validarPerfil } from "./data-loader";
import {
  caracterizarRecursoReal,
  detectarClippingReal,
  calcularPerfilHorario,
  caracterizarVariabilidadDiaria,
} from "./recurso";
import {
  diagnosticarOportunidad,
  generarEscenariosPropuesta,
} from "./diagnostico";
import {
  reconstruirCincominutal,
  construirDatosCrudos,
  construirDatosResumen,
} from "./cinco-min";
import type {
  ConfigCliente,
  EstadoAnalisis,
  PropuestaConsultor,
} from "./storage";

/**
 * Procesa el archivo del cliente con los parámetros dados y produce el análisis
 * completo (Parte 1 + Parte 2 con propuesta inicial = escenario balanceado).
 *
 * Si quieres cambiar la propuesta después, usa `resimularPropuesta()`.
 */
export async function analizarPlanta(
  buffer: ArrayBuffer,
  cliente: ConfigCliente,
): Promise<EstadoAnalisis> {
  // --- Carga y validación ---
  const perfil = cargarPerfilHorario(buffer);
  const validacion = validarPerfil(perfil);
  if (validacion.filas === 0) {
    throw new Error("El archivo no contiene filas válidas de generación.");
  }

  // --- Parte 1: caracterización del recurso real ---
  const recurso_real = caracterizarRecursoReal(
    perfil,
    cliente.poi_kw,
    cliente.cap_pv_instalada_kw,
  );
  const clipping_real = detectarClippingReal(perfil, cliente.poi_kw);
  const perfil_horario_real = calcularPerfilHorario(perfil);
  const variabilidad = caracterizarVariabilidadDiaria(perfil);
  const diagnostico = diagnosticarOportunidad(
    recurso_real,
    clipping_real,
    perfil_horario_real,
  );
  const escenarios_sugeridos = generarEscenariosPropuesta(
    perfil,
    diagnostico,
    recurso_real,
    { poi_kw: cliente.poi_kw, cap_pv_instalada_kw: cliente.cap_pv_instalada_kw },
  );

  // --- Propuesta inicial = escenario balanceado ---
  const escenarioInicial = escenarios_sugeridos.balanceado;
  const propuesta: PropuestaConsultor = {
    pv_adicional_kw: escenarioInicial.pv_adicional_kw,
    bess_p_kw: escenarioInicial.bess_p_kw || cliente.poi_kw * 0.8,
    bess_e_kwh:
      escenarioInicial.bess_e_kwh || cliente.poi_kw * 0.8 * 4,
    dod_pct: 95,
    rte_pct: 85,
  };

  // --- Parte 2: reconstrucción 5-min + simulación ---
  const cap_pv_total =
    cliente.cap_pv_instalada_kw + propuesta.pv_adicional_kw;
  const cincominutal = reconstruirCincominutal(
    perfil,
    cap_pv_total,
    cliente.poi_kw,
  );
  const crudos = construirDatosCrudos(cincominutal);
  const resumen = construirDatosResumen(cincominutal, {
    sitio: cliente.nombre_planta,
    ubicacion: cliente.ubicacion,
    capPvTotalKw: cap_pv_total,
    poiKw: cliente.poi_kw,
    bess: {
      P_kW: propuesta.bess_p_kw,
      E_kWh: propuesta.bess_e_kwh,
      DOD_pct: propuesta.dod_pct,
      RTE_pct: propuesta.rte_pct,
    },
    precioMxnMwh: cliente.precio_ppa_mxn_mwh,
    parte1: {
      recurso_real,
      clipping_real,
      variabilidad,
      diagnostico,
      escenarios_sugeridos,
      perfil_horario_real,
    },
  });

  return {
    cliente,
    propuesta,
    parte1: {
      recurso_real,
      clipping_real,
      perfil_horario: perfil_horario_real,
      variabilidad,
      diagnostico,
      escenarios_sugeridos,
    },
    crudos,
    resumen,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Re-simula con una nueva propuesta del consultor (sin volver a cargar el archivo).
 *
 * Esta función se llama desde el Onboarding cuando el consultor cambia los
 * parámetros del BESS o de PV adicional y quiere ver el efecto.
 *
 * Nota: el perfil horario original NO se persiste (sería pesado), así que esta
 * función requiere reprocesar el archivo. Si quieres llamarla muchas veces
 * sin recargar archivo, usa los crudos persistidos en `EstadoAnalisis.crudos`
 * que tienen los datos cincominutales ya escalados.
 */
export function recalcularConPropuesta(
  estado: EstadoAnalisis,
  nuevaPropuesta: PropuestaConsultor,
): EstadoAnalisis {
  const cap_pv_total =
    estado.cliente.cap_pv_instalada_kw + nuevaPropuesta.pv_adicional_kw;

  // Reconstruir cincominutal a partir del perfil original (que no persistimos).
  // Como workaround, reconstruimos los crudos a partir de los crudos previos:
  // cada hora original tenía Registrada = (gen_kwh × 12) / factor_anterior
  const factorAnterior =
    (estado.cliente.cap_pv_instalada_kw + estado.propuesta.pv_adicional_kw) /
    estado.cliente.poi_kw;
  const factorNuevo = cap_pv_total / estado.cliente.poi_kw;
  const ratio = factorNuevo / factorAnterior;

  const cincominutal_nuevo = estado.crudos.data.map(([ts, gen, poi]) => ({
    timestamp: ts,
    gen_kwh: gen * ratio,
    poi_kwh: poi,
    fecha: ts.slice(0, 10),
    hora: parseInt(ts.slice(11, 13), 10),
  }));

  const crudos_nuevos = construirDatosCrudos(cincominutal_nuevo);
  const resumen_nuevo = construirDatosResumen(cincominutal_nuevo, {
    sitio: estado.cliente.nombre_planta,
    ubicacion: estado.cliente.ubicacion,
    capPvTotalKw: cap_pv_total,
    poiKw: estado.cliente.poi_kw,
    bess: {
      P_kW: nuevaPropuesta.bess_p_kw,
      E_kWh: nuevaPropuesta.bess_e_kwh,
      DOD_pct: nuevaPropuesta.dod_pct,
      RTE_pct: nuevaPropuesta.rte_pct,
    },
    precioMxnMwh: estado.cliente.precio_ppa_mxn_mwh,
    parte1: {
      recurso_real: estado.parte1.recurso_real,
      clipping_real: estado.parte1.clipping_real,
      variabilidad: estado.parte1.variabilidad,
      diagnostico: estado.parte1.diagnostico,
      escenarios_sugeridos: estado.parte1.escenarios_sugeridos,
      perfil_horario_real: estado.parte1.perfil_horario,
    },
  });

  return {
    ...estado,
    propuesta: nuevaPropuesta,
    crudos: crudos_nuevos,
    resumen: resumen_nuevo,
    timestamp: new Date().toISOString(),
  };
}
