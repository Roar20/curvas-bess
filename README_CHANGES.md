# Simulador BESS — Actualización (v2)

Esta actualización transforma la app de un visualizador estático de un solo
cliente a un simulador multi-cliente con onboarding, diagnóstico automático y
recomendación de escenarios.

## Resumen de cambios

### Lo que cambió en filosofía

**Antes:** la app cargaba `datos_crudos.json` y `datos_resumen.json` estáticos
desde `public/`. Para procesar otra planta había que regenerar los JSONs en el
Colab y subirlos al repo.

**Ahora:** el motor del Colab está portado a TypeScript. La app procesa el
Excel del cliente directamente en el navegador y guarda el resultado en
localStorage. Sin backend, sin regenerar JSONs, sin subir archivos al repo.

### Lo que cambió en flujo

```
Antes:                              Ahora:
  /  →  Tabs                          /              →  redirige a /onboarding
                                      /onboarding    →  sube Excel + params
                                      /reporte       →  Tabs (Diagnóstico nuevo + 6 originales)
```

### Lo que cambió en código

**Archivos nuevos:**

```
src/lib/data-loader.ts         Carga Excel con SheetJS, auto-detecta header
src/lib/recurso.ts             Caracterización del recurso REAL sin escalar
src/lib/diagnostico.ts         Diagnóstico automático + 3 escenarios sugeridos
src/lib/cinco-min.ts           Reconstrucción 5-min + construcción de los JSONs
src/lib/analizar.ts            Orquestador alto nivel: archivo → análisis completo
src/lib/storage.ts             Wrapper tipado de localStorage

src/pages/Onboarding.tsx       Pantalla de carga (upload + datos contractuales)
src/components/bess/TabDiagnostico.tsx   Pestaña nueva con Parte 1

src/test/colab-parity.test.ts  Test de paridad TS vs Colab (<0.5% tolerancia)
```

**Archivos modificados:**

```
src/App.tsx                    Routing /onboarding ↔ /reporte
src/pages/Index.tsx            Lee de localStorage, agrega tab Diagnóstico, sin emojis
src/types/bess.ts              Campo opcional parte1 en ResumenData
src/components/bess/Callout.tsx        Sin iconos lucide (barra de color)
src/components/bess/TabSimulador.tsx   Sin Loader2 (pulse dot)

package.json                   Agregado xlsx ^0.18.5
```

**Sin cambios:**

- `src/lib/bess-sim.ts` — motor BESS original, sigue siendo la fuente de verdad
- `src/lib/utils.ts`
- Componentes shadcn UI internos (`src/components/ui/*`)
- Resto de los componentes bess que ya usaban estilo limpio

## Validación

El test `src/test/colab-parity.test.ts` ejecuta el motor TS contra el archivo
real de Estanzuela 2 marzo 2026 y compara contra los targets del Colab:

| Métrica                      | Target  | TS      | Δ%      |
|------------------------------|---------|---------|---------|
| PV bruta MWh                 | 195.0   | 195.08  | +0.04%  |
| Al POI MWh                   | 146.9   | 146.95  | +0.03%  |
| Curtailment MWh              | 48.1    | 48.13   | +0.06%  |
| Pico PV kW                   | 763.0   | 763.46  | +0.06%  |
| % Capturado @ 400/1600       | 95.2    | 95.04   | -0.17%  |
| % Capturado @ 250/1000       | 64.9    | 64.69   | -0.32%  |
| % Capturado @ 500/2000       | 100.0   | 100.00  | 0.00%   |

Todos dentro de tolerancia <0.5%.

Para correr el test, copia el archivo Excel a:

```
src/test/fixtures/REPORTE_ESTANZUELA_2_MAR_2026.xlsx
```

Si el archivo no está presente, el test se salta automáticamente.

## Cómo aplicar este zip sobre tu repo

1. **Descomprime el zip encima del repo local:**

   ```bash
   cd /ruta/al/repo/simulador-curvas
   unzip -o /ruta/al/zip/simulador-curvas-update.zip
   ```

   El flag `-o` sobrescribe archivos sin preguntar.

2. **Instala la dependencia nueva (xlsx):**

   ```bash
   npm install
   ```

3. **Verifica que compila:**

   ```bash
   npm run build
   ```

4. **Pruébalo localmente:**

   ```bash
   npm run dev
   ```

   Abre `http://localhost:8080/`. Deberías ver la pantalla de onboarding.

5. **Sube los cambios:**

   ```bash
   git add -A
   git commit -m "feat: onboarding, motor TS y pestaña Diagnóstico"
   git push
   ```

   Vercel se deploya automáticamente.

## Flujo de uso

1. El consultor abre la app y entra a `/onboarding`
2. Sube el Excel del cliente (formato Tequila 1 o Estanzuela 2)
3. Configura POI, capacidad PV instalada, precio PPA
4. Click en "Procesar y ver reporte"
5. Se abre `/reporte` con 7 pestañas. La primera (Diagnóstico) muestra:
   - Caracterización del recurso REAL (sin escalar)
   - Detección de clipping físico
   - Variabilidad día a día
   - Diagnóstico automático (Arquitectura A/B/B'/C)
   - Tres escenarios sugeridos
6. Las demás pestañas (Resumen, Excedente, Perfil, Simulador, Pareto,
   Decisión) muestran la simulación de la propuesta inicial (escenario
   balanceado por default)
7. En el Simulador el consultor puede mover sliders para ajustar la propuesta
   y ver el efecto en vivo
8. El análisis se guarda en localStorage del navegador. Cerrar y reabrir el
   browser preserva los datos hasta que el consultor cargue otra planta o
   borre los datos manualmente

## Limitaciones conocidas

- El archivo Excel debe seguir el formato Tequila 1 (header decorativo +
  columnas "Día de Operación", "Hora", "Energía Registrada [MWh]"). Otros
  formatos requieren mapear las columnas manualmente.
- localStorage tiene límite de ~5 MB por origen. Un año entero (8760 horas →
  105k registros 5-min) pesa unos 4 MB serializado. Para múltiples plantas
  guardadas en paralelo se podría chocar con el límite.
- La pantalla `/onboarding` está abierta — cualquiera con la URL puede subir
  un archivo. Si esto preocupa para producción, agregar autenticación.
