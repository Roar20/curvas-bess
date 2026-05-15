# Simulador BESS

Aplicación web para dimensionamiento de sistemas de almacenamiento en baterías
(BESS) sobre plantas fotovoltaicas. Carga un Excel con el perfil horario de
generación, configura parámetros del cliente y produce un reporte con
diagnóstico del recurso, perfil de excedentes, simulación cincominutal del BESS
y análisis Pareto.

## Stack

- React 18 + TypeScript + Vite + Tailwind
- shadcn/ui (Radix) para los primitivos
- recharts para gráficas
- xlsx para parseo del Excel
- vitest para tests

## Scripts

```bash
npm install
npm run dev      # http://localhost:8080
npm run build
npm test
```
