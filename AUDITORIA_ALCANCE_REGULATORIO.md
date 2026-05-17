# AUDITORIA_ALCANCE_REGULATORIO.md

Auditoría read-only del repo `Roar20/curvas-bess` (commit base de esta inspección: `011d6ac`). Objetivo: cuantificar qué tan entrelazado está el concepto **"PV adicional / overbuild / PV escalado"** con el motor de cálculo y la UI, para decidir si conviene limpiar este repo o empezar uno nuevo.

Marco regulatorio aplicable: bajo **CRE A/113/2024**, el BESS NO suma capacidad de generación al SFV existente. La capacidad CFE del cliente Tequila se mantiene en 500 kW (POI) y la PV instalada en 500 kW. **No hay overbuild ni PV adicional**. Toda la lógica que reescala la generación a una PV total mayor (900 kW en el caso fixture) es metodológica y regulatoriamente inaplicable para este cliente.

---

## 1. INVENTARIO DE STRINGS PROBLEMÁTICOS EN UI

Búsqueda case-sensitive con los términos del prompt. Ordenado por archivo.

### `src/components/bess/TabResumen.tsx`

| Línea | Snippet |
|---|---|
| 16 | `? "Sin overbuild propuesto"` |
| 20 | `` ? `Escenario propuesto: PV ${fmtN(pvActual)} kW sin overbuild` `` |
| 21 | `` : `Escenario propuesto: PV ${fmtN(pvActual)} + ${fmtN(pvAdicional)} kW de overbuild`; `` |
| 41 | `<MetricCard label="Energía PV bruta" value={fmtN(r.energia_pv_bruta_MWh, 1)} unit="MWh" />` |
| 57 | `label="PV total proyecto"` (card que muestra `pvTotal` = `r.cap_pv_total_kW` con hint `subtextoPV`) |

### `src/components/bess/TabSimulador.tsx`

| Línea | Snippet |
|---|---|
| 91 | `PV bruta:` (etiqueta en el tooltip del chart) |
| 475 | `name="PV bruta"` (legend del ComposedChart) |
| 508 | `label="Gen PV bruta"` (MiniMetric card "Gen PV bruta") |

### `src/components/bess/TabDespacho.tsx` + subcomponentes

| Archivo | Línea | Snippet |
|---|---|---|
| `DespachoTablaTecnica.tsx` | 48 | `<TableHead className="text-right">PV bruta (kWh)</TableHead>` |

### `src/components/bess/TabDiagnostico.tsx`

| Línea | Snippet |
|---|---|
| 18 | `headroom_al_poi_pct: number;` (interface) |
| 53 | `pv_adicional_kw: number;` (interface Escenario) |
| 80 | `B: { titulo: "PV adicional + BESS", color: ... }` |
| 82 | `titulo: "PV adicional + BESS con desplazamiento",` (arquitectura B') |
| 115 | `Sin escalado, sin propuesta — solo los datos del cliente.` (subtítulo header — irónicamente correcto, pero los escenarios sí proponen escalado) |
| 140-144 | MetricCard `label="Headroom al POI"` con `variant="success" si headroom > 10` |
| 317-320 | UI de las 3 cards de escenarios: `PV adicional` + `+{escenario.pv_adicional_kw} kW` + `Total proyecto: {escenario.cap_pv_total_kw} kW` |

### `src/lib/diagnostico.ts` (strings dentro de mensajes UI)

| Línea | Snippet |
|---|---|
| 111 | `tipo_principal: "Headroom alto + generación NO coincide con punta CFE"` |
| 114 | `` `Arquitectura B' — agregar PV adicional + BESS. La planta opera al ` `` |
| 119 | `` `El pico observado es ${pico_pct}% del POI — el ${headroom_pct}% del POI no se usa.` `` |
| 122 | `` `Agregar PV adicional saturaría el POI durante el día, y el BESS desplazaría ese sobrante a la hora punta.` `` |
| 128-135 | Caso 2 sin punta: `tipo_principal: "Headroom alto"`, `Arquitectura B — considerar agregar PV adicional`, `Una expansión de PV puede llenar ese headroom y generar más energía.` |
| 152 | `` `No hay clipping físico ni headroom relevante.` `` |
| 164-168 | Caso intermedio: `Arquitectura B — explorar PV adicional moderada`, `Headroom moderado de ${headroom_pct}%` |
| 273 | `justificacion: "Sin PV adicional, no hay excedente que capturar."` (caso `capPvTotalKw <= poiKw`) |

### `src/lib/analizar.ts`

| Línea | Snippet |
|---|---|
| 77 | `pv_adicional_kw: escenarioInicial.pv_adicional_kw,` |
| 87 | `cliente.cap_pv_instalada_kw + propuesta.pv_adicional_kw;` (suma para `cap_pv_total`) |
| 156 | comentario: `parámetros del BESS o de PV adicional y quiere ver el efecto.` |
| 161 | comentario: `que tienen los datos cincominutales ya escalados.` |
| 168 | `estado.cliente.cap_pv_instalada_kw + nuevaPropuesta.pv_adicional_kw;` (en `recalcularConPropuesta`) |
| 174 | `(estado.cliente.cap_pv_instalada_kw + estado.propuesta.pv_adicional_kw) /` (cálculo de `factorAnterior`) |

### `src/lib/cinco-min.ts`

| Línea | Snippet |
|---|---|
| 2 | `* Reconstrucción cincominutal sintética con escalado PV/POI.` |
| 36 | `*   - PV bruta horaria escalada: E_bruta_h = E_h × (CAP_PV_TOTAL / POI)` |
| 129 | `// Métricas del recurso del escenario propuesto (con escalado)` |

### `src/lib/storage.ts`

| Línea | Snippet |
|---|---|
| 6 | comentario header: `bess.propuesta → PropuestaConsultor (PV adicional, BESS p, BESS e, etc.)` |
| 32 | `pv_adicional_kw: number;` en `interface PropuestaConsultor` |

### `src/lib/recurso.ts`

| Línea | Snippet |
|---|---|
| 5 | comentario: `SIN escalar por overbuild. Réplica de las funciones de Parte 1 del Colab.` |
| 21 | `headroom_al_poi_pct: number;` (interface RecursoReal) |
| 53 | `const headroom_pct = ((poiKw - pico_kw) / poiKw) * 100;` |
| 63 | `headroom_al_poi_pct: round(headroom_pct, 2),` |

### `src/test/colab-parity.test.ts`

| Línea | Snippet |
|---|---|
| 60 | `const PV_TOTAL = 900; // overbuild 400` |
| 84-85 | `expect(escenarios.balanceado.pv_adicional_kw).toBe(350);` y `.agresivo.pv_adicional_kw).toBe(500);` |
| 88 | `const cincominutal = reconstruirCincominutal(perfil, PV_TOTAL, POI);` (test corre con 900 kW escalado, no con 500 reales) |
| 100 | comentario: `// Sumar PV bruta, Al POI, Curtailment` |
| 111 | `expectWithinTolerance(pv_mwh, TARGETS.energia_pv_bruta_MWh, "PV bruta");` |

**Conteo:** 5 archivos UI tocan el concepto. **>40 líneas de texto cliente-facing** mencionan "overbuild / PV adicional / headroom" directamente, más una docena de comentarios técnicos. La narrativa del diagnóstico (cases B, B', "intermedio") es enteramente sobre proponer overbuild.

---

## 2. INVENTARIO DE LÓGICA DE NEGOCIO RELACIONADA

### 2.1 `reconstruirCincominutal(perfil, capPvTotalKw, poiKw)` — `src/lib/cinco-min.ts:41`

**Qué hace.** Toma el perfil horario REAL del cliente (kWh medidos por hora) y produce una serie cincominutal SINTÉTICA reescalada. El factor de escalado es `capPvTotalKw / poiKw`. Si `capPvTotal = 900` y `poi = 500`, multiplica cada lectura por 1.8 antes de repartirla en 12 slots de 5 min. El "techo" se mantiene en `poiKw × 5/60`, lo que produce clipping artificial cuando el gen escalado excede al POI.

**Signatura.**
```ts
export function reconstruirCincominutal(
  perfil: PerfilHorario[],
  capPvTotalKw: number,
  poiKw: number,
): Cincominutal[]
```

**Quién la llama.**
- `src/lib/analizar.ts:88` — desde `analizarPlanta()` con `cap_pv_total = capInstalada + propuesta.pv_adicional_kw`.
- `src/test/colab-parity.test.ts:88` — desde el test con `PV_TOTAL = 900`.

### 2.2 `construirDatosResumen(cincominutal, ctx)` — `src/lib/cinco-min.ts:122`

Consume directamente los `cincominutal` ya reescalados. Calcula `recurso_pv.energia_pv_bruta_MWh`, `energia_al_poi_MWh`, `curtailment_MWh`, `curtailment_pct`, `pico_pv_kW`, `cap_pv_total_kW`, `factor_planta_pct`, `horas_sol_diarias_promedio` — todos sobre la PV escalada (900 kW), no la real (500 kW).

Adicionalmente corre `simularBESS()` sobre los `crudos_para_sim` derivados de la serie escalada, para las 4 simulaciones canónicas + Pareto + `dias_detalle`.

### 2.3 `estimarPicoExcedentePropuesto(perfil, capPvTotalKw, poiKw)` — `src/lib/diagnostico.ts:178`

Multiplica cada hora real por `capPvTotalKw / poiKw` y resta `poiKw/1000` para estimar excedente diario p75/p50/máx asumiendo overbuild. Devuelve un `ExcedenteEstimado` que alimenta los escenarios sugeridos.

### 2.4 `recomendarPvAdicional(diagnostico, recurso, cliente, nivel)` — `src/lib/diagnostico.ts:216`

Devuelve cuántos kW de PV adicional sugerir según el nivel (conservador/balanceado/agresivo) y el `pico_vs_poi_pct` del recurso real. Ratios hardcoded de 0.3 a 1.2 sobre la PV actual. Redondea a múltiplos de 50 kW.

### 2.5 `dimensionarBess(perfil, capPvTotalKw, poiKw, nivel)` — `src/lib/diagnostico.ts:259`

Dimensiona P/E del BESS asumiendo overbuild. Si `capPvTotalKw <= poiKw` devuelve `{ p_kw: 0, e_kwh: 0, justificacion: "Sin PV adicional, no hay excedente que capturar." }`. Es decir: **sin overbuild, la app entrega un BESS de 0 kW**.

### 2.6 `generarEscenariosPropuesta(perfil, diag, recurso, cliente)` — `src/lib/diagnostico.ts:310`

Para cada nivel: corre `recomendarPvAdicional` → `dimensionarBess` y arma el `Escenario` con `pv_adicional_kw`, `cap_pv_total_kw`, `factor_pv_poi`, `bess_p_kw`, `bess_e_kwh`. La estructura `Escenario` está construida alrededor de "qué overbuild proponer".

### 2.7 `diagnosticarOportunidad(recurso, clipping, perfilH)` — `src/lib/diagnostico.ts:67`

Clasifica la planta en arquitecturas:
- **A** = solo BESS (cuando hay clipping físico real > 5%).
- **B** = "agregar PV adicional + BESS" (cuando `pico_vs_poi_pct < 80`).
- **B'** = "agregar PV adicional + BESS con desplazamiento" (cuando además la gen termina antes de la punta CFE).
- **C** = no recomendar inversión.

Tres de cuatro arquitecturas recomendan overbuild. Para Tequila (sin clipping, headroom de ~15%) el clasificador entra al caso B o B'.

### 2.8 Estructura del estado guardado (`storage.ts`)

```ts
ConfigCliente {
  cap_pv_instalada_kw: number;   // la real
  ...
}
PropuestaConsultor {
  pv_adicional_kw: number;       // el overbuild
  bess_p_kw, bess_e_kwh, dod_pct, rte_pct
}
```

`pv_adicional_kw` es un campo de primera clase de la propuesta del consultor.

### 2.9 Resumen tabular

| Función | Archivo:línea | Reescala | Consumidores |
|---|---|---|---|
| `reconstruirCincominutal` | `cinco-min.ts:41` | sí, factor = capTotal/POI | `analizar.ts:88`, test L88 |
| `construirDatosResumen` | `cinco-min.ts:122` | sí (lee crudos escalados) | `analizar.ts:94`, `analizar.ts:178` (recalcular) |
| `estimarPicoExcedentePropuesto` | `diagnostico.ts:178` | sí | `dimensionarBess` |
| `recomendarPvAdicional` | `diagnostico.ts:216` | n/a (decide cuánto) | `generarEscenariosPropuesta` |
| `dimensionarBess` | `diagnostico.ts:259` | sí (via `estimarPicoExcedentePropuesto`) | `generarEscenariosPropuesta` |
| `generarEscenariosPropuesta` | `diagnostico.ts:310` | sí (transitivo) | `analizar.ts:67` |
| `diagnosticarOportunidad` | `diagnostico.ts:67` | n/a (clasifica) | `analizar.ts:62` |
| `caracterizarRecursoReal` | `recurso.ts:32` | **no** — devuelve `headroom_al_poi_pct` que la UI lee como "oportunidad de overbuild" | `analizar.ts:54` |

---

## 3. MAPA DE DEPENDENCIAS

```
Onboarding.tsx
  └─> analizarPlanta(buffer, cliente)            [analizar.ts]
        ├─> cargarPerfilHorario                  (sin escalado, OK)
        ├─> caracterizarRecursoReal              (sin escalado, EXPONE headroom_al_poi_pct)
        ├─> detectarClippingReal                 (sin escalado, OK)
        ├─> calcularPerfilHorario                (sin escalado, OK)
        ├─> caracterizarVariabilidadDiaria       (sin escalado, OK)
        ├─> diagnosticarOportunidad
        │     └─> case B / B' / intermedio        ⇨ "agregar PV adicional"
        ├─> generarEscenariosPropuesta
        │     ├─> recomendarPvAdicional           ⇨ devuelve 0/150/350/500…
        │     └─> dimensionarBess
        │           └─> estimarPicoExcedentePropuesto  ⇨ ESCALA gen × (capTotal/POI)
        │
        ├─> propuesta.pv_adicional_kw = escenario.balanceado.pv_adicional_kw
        │
        ├─> cap_pv_total = cap_pv_instalada + pv_adicional         ★ PUNTO DE CONTAMINACIÓN ★
        ├─> reconstruirCincominutal(perfil, cap_pv_total, poi)     ⇨ TODA la serie 5-min se escala
        ├─> construirDatosCrudos(cincominutal)                     ⇨ crudos persisten ya escalados
        ├─> construirDatosResumen(cincominutal, {capPvTotalKw, …}) ⇨ ResumenData.recurso_pv refleja PV escalada
        │     └─> simularBESS(crudos escalados) x 4 + Pareto
        │
        └─> compararEstrategias(crudos escalados, …)               ⇨ Parte 2 también opera sobre 900 kW

storage.guardarAnalisis()
  └─> persiste crudos YA ESCALADOS + resumen YA ESCALADO + ConfigCliente + PropuestaConsultor.pv_adicional_kw

Tabs que consumen ResumenData:
  TabDiagnostico      → recurso_real (sin escalar), pero MUESTRA escenarios con pv_adicional
  TabResumen          → recurso_pv (ESCALADO) + Card "PV total proyecto"
  TabExcedente        → excedente_diario (calculado SOBRE serie escalada)
  TabPerfil           → estadisticos_excedente + perfil_horario (ESCALADO)
  TabSimulador        → simulaciones (corridas sobre crudos ESCALADOS), label "PV bruta"
  TabDespacho         → simulaciones.dias_detalle (ESCALADO) + DespachoTablaTecnica "PV bruta"
  TabPareto           → pareto (corrido sobre crudos ESCALADOS)
  TabDecision         → simulaciones, estadisticos_excedente (ESCALADO)
  TabEstrategia       → parte2 = compararEstrategias(crudos ESCALADOS)
```

**Conclusión del grafo.** El escalado entra en `analizar.ts:87` (suma `cap_pv_total = capInstalada + pv_adicional`) y de ahí propaga por **toda la simulación 5-min**. Los `crudos` persistidos en localStorage son producto del escalado, no de la serie real. Las 8 pestañas que consumen `ResumenData` o `parte2` están leyendo, sin excepción, datos de la planta escalada de 900 kW, no de la planta real de 500 kW.

Solo `caracterizarRecursoReal`, `detectarClippingReal`, `calcularPerfilHorario` y `caracterizarVariabilidadDiaria` operan sobre el perfil sin escalar — sus outputs viven dentro de `parte1` y se muestran en `TabDiagnostico` (las primeras 4 MetricCards) y en la card "Detección de clipping real". El resto es escalado.

---

## 4. AUDITORÍA DE PARIDAD NUMÉRICA (PR #13)

> **Pregunta del prompt.** ¿Qué función produce el número 589.86 MWh de cargado que se validó contra Colab? ¿Opera sobre SFV real (500 kW POI fijo) o sobre SFV escalado a 900 kW?

**Respuesta directa.** El fixture y los targets del PR #13 corren con `PV_TOTAL = 900 kW` y POI = 500 kW. El número de cargado/capturado proviene de `simularBESS()` en `src/lib/bess-sim.ts:41`, alimentado por crudos cincominutales generados con `reconstruirCincominutal(perfil, 900, 500)` en `src/test/colab-parity.test.ts:88`.

Evidencia textual del test:

```ts
// src/test/colab-parity.test.ts
const POI = 500;
const CAP_INST = 500;
const PV_TOTAL = 900;  // overbuild 400

const cincominutal = reconstruirCincominutal(perfil, PV_TOTAL, POI);
const sim400 = simularBESS(crudos, 400, 1600, 0.95, 0.85);
expectWithinTolerance(sim400.pct_capturado, TARGETS.pct_capturado_400_1600, "% capt 400/1600");
// TARGETS.pct_capturado_400_1600 = 95.2
// TARGETS.energia_pv_bruta_MWh = 195.0  (en marzo, escalado 1.8x)
// TARGETS.energia_al_poi_MWh = 146.9
```

Es decir: el motor `simularBESS` per se es agnóstico al escalado — solo recibe una serie de `(timestamp, gen_kWh_slot, techo_kWh_slot)` y opera con ella. La paridad se valida en un escenario **escalado 1.8×** porque el fixture del Colab así lo arma.

**Qué pasaría si se le pasa SFV = 500 kW puro al motor.**

Documentando por inferencia, sin ejecutar:

1. El perfil del fixture marzo 2026 (`PV instalada real 500 kW`) tiene `pico_kw = 424.14` (validado en el test L64). El POI es 500. Por lo tanto **la gen real nunca alcanza el POI**: `pico_kw / POI = 84.8%`.
2. Si llamáramos `reconstruirCincominutal(perfil, 500, 500)` el factor de escalado sería 1.0. Cada slot 5-min recibiría `gen_kwh = (E_h × 1) / 12`. El "techo" por slot es `500 × 5/60 = 41.67 kWh`. Como `gen_kw ≤ 424.14 ≤ 500`, **ningún slot superaría el techo**. Por tanto:
   - `excedente_total = 0` para todos los slots.
   - `simularBESS()` retornaría `cargado_kWh ≈ 0` (greedy nunca dispara la rama de carga).
   - `descargado_kWh ≈ 0`.
   - `pct_capturado` indefinido (denominador 0).
3. La estrategia greedy quedaría **inútil** sobre el SFV real de Tequila.
4. `simularArbitrajeLalo()` sí podría cargar fuera de hora punta usando energía bajo techo y descargar en 18-22h. Pero esa rama de "carga con generable" solo entra cuando `gen > 0`, y aún así está acotada por `P_int` y por el espacio en SOC. El número resultante de `descargado_kWh` no se ha validado contra ningún target — el test del Colab no cubre arbitraje sobre la planta sin escalar.

**Inferencia clave.** El "589.86 MWh de cargado" (asumo que se refiere a la magnitud agregada anualizada del PR #13 sobre Tequila escalado a 900) **no se puede reproducir sobre la planta real porque la planta real no tiene clipping físico**. Esa cifra es un artefacto del escalado metodológico que CRE A/113/2024 prohíbe modelar como capacidad adicional.

---

## 5. AUDITORÍA DE LOS 3 BUGS REPORTADOS POR EL COMERCIAL

### Bug A — Resumen dice "Curtailment 195.5 MWh / 11.9%" pero Diagnóstico dice "0 horas en clipping"

**De dónde sale cada número.**

| Métrica | Origen | Sobre qué dato | Valor |
|---|---|---|---|
| Tab Resumen "Curtailment 195.5 MWh / 11.9%" | `recurso_pv.curtailment_MWh` y `.curtailment_pct` calculados en `cinco-min.ts:140` (`clip = pv_bruta - al_poi`) | Serie 5-min ESCALADA a 900 kW PV | "Pérdida" cuando `gen_escalado` excede al POI por slot |
| Tab Diagnóstico "0 horas en clipping" | `parte1.clipping_real.horas_en_clipping` calculado en `recurso.ts:88` | Perfil horario REAL (500 kW PV) | Cuenta horas donde `Registrada ≥ POI × 0.99`. Como pico real = 424 kW ≤ 500 = POI, nunca toca |

**Por qué la inconsistencia.** Los dos números miden el mismo concepto físico (clipping) sobre **dos plantas distintas**:
- "0 horas" es la verdad observada sobre la planta hoy (500 kW reales). No hay clipping.
- "195.5 MWh / 11.9%" es un curtailment **simulado contrafactualmente** asumiendo overbuild a 900 kW. Cuando el cinco-minutal escalado supera el POI, la app llama "curtailment" a la diferencia.

Es decir: la app está mezclando en la misma tab Resumen una métrica del recurso REAL ("PV instalada actual") con una métrica del escenario PROYECTADO ("curtailment del overbuild propuesto"). El consultor lee 11.9% y asume problema operacional; en realidad es la proyección del modelo bajo un escalado regulatoriamente inválido.

### Bug B — Factor de planta 20.9% en Tab Resumen (¿qué denominador?)

**Origen del cálculo.** `cinco-min.ts:318-321`:

```ts
const factor_planta_pct =
  capPvTotalKw > 0 && horas_total > 0
    ? ((pv_bruta * 1000) / (capPvTotalKw * horas_total)) * 100
    : 0;
```

- `capPvTotalKw` = `cap_pv_instalada + pv_adicional` = **900 kW** (escalado).
- `pv_bruta` = suma de la generación cincominutal ya escalada.
- `horas_total` = `n_slots × 5/60`.

**Denominador = capacidad PV total proyectada (900 kW), NO SFV+BESS.** Etiquetar este número como "factor de planta" en la tab Resumen mezcla dos cosas:
1. Conceptualmente es factor de capacidad del SFV (denominador = kW PV instalados).
2. Numéricamente está dividiendo por 900 kW, no por 500 kW reales.

Si denomináramos por 500 kW reales (que es lo aplicable bajo CRE A/113/2024), el factor sería ≈ 20.9% × (900/500) ≈ 37.6% (números aproximados — la generación real es la del perfil sin escalar, energía total ≈ 108.38 MWh según `validarPerfil` en el test). Recalculando con la energía real: `(108.38 × 1000) / (500 × 744 h) × 100 ≈ 29.1%` — esto coincide con el `recurso.factor_planta_pct = 29.13` validado en el test L65 sobre Parte 1.

**Dónde debería vivir.** El número 29.1% (factor de planta real, denominador 500 kW) ya existe y se muestra en **TabDiagnostico** (línea 134-138, MetricCard "Factor de planta", lee `parte1.recurso_real.factor_planta_pct`). El 20.9% de TabResumen es un valor distinto: factor de planta del **escenario escalado**, con denominador 900 kW. Bajo el marco regulatorio, ese 20.9% no debería existir en la app — el único factor de planta válido es el 29.1% sobre los 500 kW reales.

### Bug C — Energía PV bruta 1644 MWh → Entregada al POI 1448.5 MWh. ¿La diferencia es eficiencia inversor, curtailment simulado, o mezcla?

**Origen.** `cinco-min.ts:130-140`:

```ts
let pv_bruta_kwh = 0;
let al_poi_kwh = 0;
for (const r of cincominutal) {
  pv_bruta_kwh += r.gen_kwh;
  al_poi_kwh += Math.min(r.gen_kwh, r.poi_kwh);
}
const pv_bruta = pv_bruta_kwh / 1000;     // 1644 MWh
const al_poi = al_poi_kwh / 1000;          // 1448.5 MWh
const clip = pv_bruta - al_poi;            // 195.5 MWh
```

donde cada `r.gen_kwh` es el output de `reconstruirCincominutal(perfil, 900, 500)`, es decir el perfil real **multiplicado por 1.8** y repartido en slots de 5 min.

**Es 100% curtailment simulado del escalado**, NO eficiencia inversor. Específicamente:

- No hay modelo de inversor en el código. `data-loader.ts` lee "Energía Registrada [MWh]" del Excel del cliente (que ya es energía AC post-inversor). No se aplica ningún factor de eficiencia adicional.
- No hay degradación PV. No hay pérdidas DC→AC. No hay sombras, soiling, ni nada.
- La **única** fuente de la diferencia `1644 − 1448.5 = 195.5 MWh` es que el motor toma cada hora real, la multiplica por `900/500 = 1.8`, y donde el resultado excede `POI × dt` lo trunca con `Math.min(gen, techo)`.

El callout literal de TabResumen línea 67-70 lo dice así:
> *"De cada 100 kWh que la PV produce, 11.9 kWh se pierden porque el techo POI de 500 kW recorta los picos. Ese 11.9% es el target técnico del BESS: capturarlo y desplazarlo a horas sin sol."*

Esa frase es **factualmente falsa para Tequila bajo CRE A/113/2024**: ni hay 11.9% de pérdidas (la planta real entrega 100% al POI sin clipping), ni hay "target técnico del BESS" para capturar algo que no existe. El número está construido enteramente sobre la suposición prohibida de que la PV se va a expandir a 900 kW.

---

## 6. RECOMENDACIÓN

### a) ¿La capa "+PV" está aislada o transversal?

**Transversal en la capa de datos, aislada solo en la capa de presentación pura.**

- **Aislada (extirpable file-by-file):**
  - Strings UI en `TabResumen.tsx`, `TabDespacho.tsx`, `TabSimulador.tsx`, `TabDiagnostico.tsx`, `DespachoTablaTecnica.tsx`.
  - Card "PV total proyecto" + badge "Escenario propuesto" en `TabResumen`.
  - Sección "Escenarios sugeridos" + cards de Arquitectura B/B' en `TabDiagnostico`.
  - Campo `pv_adicional_kw` en `ConfigCliente`/`PropuestaConsultor` (`storage.ts:32`).

- **Transversal en el motor:**
  - `reconstruirCincominutal()` recibe `capPvTotalKw` y **toda** la simulación posterior depende de la serie escalada. Para Tequila habría que llamarla con `capPvTotalKw = poiKw = 500` para anular el escalado (factor = 1.0), pero entonces el motor entero produce ceros.
  - `construirDatosResumen()` calcula `recurso_pv.*` directamente sobre los crudos escalados.
  - `analizar.ts` line 87 hace la suma `cap_pv_total = capInstalada + pv_adicional` — punto único de contaminación, pero su impacto fluye hacia todas las pestañas vía `crudos`/`resumen`.
  - `diagnostico.ts` entero está construido alrededor de "arquitectura A/B/B'/C" donde 3 de 4 ramas recomiendan overbuild. `recomendarPvAdicional()` y `dimensionarBess()` solo tienen sentido bajo el supuesto de escalado.
  - El test `colab-parity.test.ts` está atado al fixture escalado a 900 kW. **Si quitamos el escalado pierde sus targets** (TARGETS son sobre la serie escalada). No hay test de paridad de la planta real.

### b) Si se extirpa, ¿qué tabs sobreviven y cuáles hay que reescribir?

| Tab | Estado tras extirpación |
|---|---|
| **TabDiagnostico** | Sobrevive parcial. Las 4 MetricCards superiores (`energia_total_mwh`, `pico_kw`, `factor_planta_pct`, `headroom_al_poi_pct`) leen de `parte1.recurso_real` y son sobre la planta REAL. La narrativa "Headroom alto + ..." y la sección "Escenarios sugeridos" hay que **eliminar o reformular** porque proponen overbuild. |
| **TabResumen** | **Hay que reescribir.** Toda la sección lee `recurso_pv.*` que es escalado. Sin escalado, esos números son ceros (curtailment) o irrelevantes (cap_pv_total = capInstalada). El callout final del bug C debe eliminarse. |
| **TabPerfil** | **Hay que reescribir el modelo de datos.** `estadisticos_excedente` y `perfil_horario` se calculan sobre crudos escalados. Sin escalado, todos los excedentes son 0 y el simulador BESS no tiene material que despachar. Hay que cambiar el modelo: el BESS no descarga "excedente" sino "energía deliberadamente cargada del SFV durante el día". |
| **TabExcedente** | **Sin lógica residual.** La pestaña entera se construye sobre `excedente_diario` que es 0 sin overbuild. Hay que decidir si se elimina o si se reconvierte en "carga diaria del BESS" (modelo arbitraje puro). |
| **TabSimulador** | Sobrevive si y solo si se cambia el modelo del sim. El gráfico de día agregado y los KPIs siguen funcionando, pero "PV bruta" hay que renombrar a "Generación SFV (real)" y los valores de `cargado/descargado/perdido` salen del nuevo motor (arbitraje). |
| **TabDespacho** | Sobrevive en estructura. La frase narrativa "Durante X horas del día tu planta genera más energía de la que puede inyectar a la red" es falsa para Tequila — debe reescribirse a "Durante X horas tu batería se carga del SFV existente para descargar en hora punta". |
| **TabPareto** | Sobrevive si se reconvierte el motor a arbitraje. El gráfico pct_capturado vs P/E sigue siendo útil pero "capturado" deja de significar clipping. |
| **TabDecision** | Sobrevive parcial. Las 4 ReasoningCards usan `estadisticos_excedente` y `recomendacion`. Sin overbuild las preguntas "¿cuánta energía sobra cada día?" no tienen sentido — habría que reformular a "¿cuánta energía vale la pena arbitrar?". |
| **TabEstrategia** | Sobrevive estructuralmente — la lógica greedy vs arbitraje sigue siendo válida. **Greedy quedaría siempre con descarga ≈ 0** (no hay clipping) y arbitraje es la única estrategia con sentido. La narrativa "comparativa" pierde fuerza. |

### c) Estimado en líneas de código

Conteo aproximado basado en `wc -l` y los hits del inventario:

| Acción | LOC | Archivos |
|---|---|---|
| **Borrar** | ≈ 700 | `diagnostico.ts` entero (340), sección "Escenarios sugeridos" en `TabDiagnostico.tsx` (~110), badge + card "PV total" en `TabResumen.tsx` (~30), strings de UI y comentarios (~30), campos `pv_adicional_kw` + `cap_pv_total_kw` en types/storage (~10), código de `reconstruirCincominutal` escalado (~30), targets de test escalado (~30) |
| **Reescribir** | ≈ 1 500 | `cinco-min.ts` completo (440) para que opere sobre serie real sin escalar, `TabExcedente.tsx` (501) o eliminarlo, `TabResumen.tsx` (74), `TabPerfil.tsx` (169), reescribir narrativas/labels en `TabSimulador.tsx` (~50), `TabDespacho.tsx` (~50), `TabDecision.tsx` (~50), `analizar.ts` (~80) y `Onboarding.tsx` (~20) para quitar el input `pv_adicional_kw` |
| **Conservar tal cual** | ≈ 1 800 | `bess-sim.ts` (287) — el motor 5-min greedy/arbitraje no asume escalado, `estrategia.ts` (166), `agregaciones.ts` (292), `recurso.ts` (311) — caracteriza el recurso real, `data-loader.ts` (176), `storage.ts` (133 con campos removidos), `HeatmapDiaHora.tsx` (246), `TabEstrategia.tsx` y subcomponentes (~250), `Index.tsx` (216), todo `components/ui/*` (no contado) |

Total no-UI tocado: ~4 000 LOC con ~700 borradas, ~1 500 reescritas, ~1 800 conservadas. Más toda la capa shadcn intacta.

### d) Veredicto

**Recomiendo empezar un repo nuevo.** Las razones concretas, derivadas de las secciones 1-5:

1. **El acoplamiento PV-adicional al motor de cálculo es transversal, no aislable.** `reconstruirCincominutal` es el cuello de embudo por donde pasa toda la serie 5-min que alimenta a 8 pestañas + el motor BESS. Eliminar el escalado equivale a invalidar los outputs de todas las pestañas que usan `crudos`/`resumen` — y dejar `cargado_kWh ≈ 0` en el motor greedy. La capa de "+PV" no es decorativa: es estructural.

2. **El diagnóstico es ideológicamente "overbuild-first".** Tres de cuatro arquitecturas que clasifica `diagnosticarOportunidad()` recomiendan PV adicional. Para una planta sin clipping y con headroom (Tequila), la app **siempre** caería en caso B o B' y la narrativa siempre diría "agregar PV adicional + BESS". Tendrías que reescribir el clasificador entero, porque su taxonomía fue construida bajo la asunción regulatoria opuesta.

3. **La validación contra Colab está atada al overbuild.** El único test de paridad (`colab-parity.test.ts`) usa `PV_TOTAL = 900` y sus targets (`pv_bruta_MWh`, `curtailment_MWh`, `pct_capturado_X_Y`) son del escenario escalado. Al quitar el escalado pierdes tu única red de seguridad — y construir tests nuevos para la planta real requiere primero un nuevo motor y nuevos números de referencia.

4. **Tres bugs serios visibles ya están sobre la mesa.** Los bugs A/B/C que reportó el comercial no son glitches de presentación: son **manifestaciones del modelo metodológicamente roto bajo CRE A/113/2024**. Curtailment 195 MWh, factor de planta 20.9%, "11.9% del POI se pierde" — son las salidas que **el modelo escalado debe producir**. Arreglarlos uno a uno sería pegar curitas a un modelo conceptualmente equivocado.

5. **El reescribir cuesta más que el conservar en términos de riesgo de regresión.** ≈ 1 500 LOC de reescritura tocan los puntos más sensibles del motor y la UI. La probabilidad de introducir bugs sutiles (signos cambiados, units, edge cases con dias_detalle, persistencia de schema viejo en localStorage de usuarios existentes) es alta. Un repo nuevo con la asunción correcta desde el día 0 evita esa deuda y permite reaprovechar los activos limpios (motor `bess-sim.ts`, `estrategia.ts`, `agregaciones.ts`, `data-loader.ts`, `recurso.ts`, todos los primitivos shadcn y los componentes `TabEstrategia`/`HeatmapDiaHora` que son agnósticos al escalado) vía copy-paste selectivo.

**Plan recomendado.** Repo nuevo `curvas-bess-v2` o similar, con:
- `data-loader.ts`, `recurso.ts`, `bess-sim.ts`, `estrategia.ts`, `agregaciones.ts`, primitivos shadcn ⇒ copy paste tal cual.
- Motor 5-min nuevo que opere sobre el perfil real sin escalar (función `serializarCincominutal(perfil, poi)` sin parámetro de capacidad PV total).
- Modelo conceptual del BESS: arbitraje puro (greedy queda como referencia degenerada porque sin clipping descarga 0). Toda la narrativa cliente alineada a "el BESS desplaza energía del día a la noche, no aumenta tu capacidad CFE".
- `TabDiagnostico` reformulado: clasifica plantas por "qué tan atractivo es el arbitraje" (función del % de gen en hora punta, ratio kW pico / POI, variabilidad), no por "cuánto overbuild proponer".
- Test de paridad nuevo: corre el fixture marzo 2026 con `POI=500, capInstalada=500` y valida que `simularArbitrajeLalo` produce los números que validemos manualmente fuera de la app (no contra el Colab actual, que está escalado).

Estimado de esfuerzo del repo nuevo: 3-5 días de trabajo concentrado vs. ~1-2 semanas de cleanup + testing en este repo con riesgo permanente de carriles laterales del overbuild que se nos pasaron.
