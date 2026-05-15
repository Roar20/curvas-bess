import { useMemo, useState } from "react";
import type { ResumenData } from "@/types/bess";

// Aproximación de la rampa YlOrRd de matplotlib en 5 paradas
const COLOR_STOPS: Array<[number, [number, number, number]]> = [
  [0.0, [255, 255, 229]],
  [0.25, [254, 217, 118]],
  [0.5, [253, 141, 60]],
  [0.75, [240, 59, 32]],
  [1.0, [177, 0, 38]],
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function colorFor(t: number): string {
  const x = Math.max(0, Math.min(1, t));
  for (let i = 1; i < COLOR_STOPS.length; i++) {
    const [t0, c0] = COLOR_STOPS[i - 1];
    const [t1, c1] = COLOR_STOPS[i];
    if (x <= t1) {
      const frac = t1 === t0 ? 0 : (x - t0) / (t1 - t0);
      const r = Math.round(lerp(c0[0], c1[0], frac));
      const g = Math.round(lerp(c0[1], c1[1], frac));
      const b = Math.round(lerp(c0[2], c1[2], frac));
      return `rgb(${r}, ${g}, ${b})`;
    }
  }
  const last = COLOR_STOPS[COLOR_STOPS.length - 1][1];
  return `rgb(${last[0]}, ${last[1]}, ${last[2]})`;
}

type Columna = {
  etiqueta: string;
  detalle: string; // tooltip-friendly label
  valores: number[]; // 24 entradas, kW promedio
};

export function HeatmapDiaHora({ data }: { data: ResumenData }) {
  const fechas = useMemo(
    () => Object.keys(data.simulaciones.dias_detalle).sort(),
    [data.simulaciones.dias_detalle],
  );

  const agruparPorSemana = fechas.length > 60;

  const columnas = useMemo<Columna[]>(() => {
    if (fechas.length === 0) return [];
    if (!agruparPorSemana) {
      return fechas.map((f, i) => {
        const d = data.simulaciones.dias_detalle[f];
        const valores: number[] = new Array(24).fill(0);
        if (d) {
          for (let h = 0; h < 24; h++) valores[h] = d.gen[h] ?? 0;
        }
        return {
          etiqueta: `${i + 1}`,
          detalle: `Día ${i + 1} (${f})`,
          valores,
        };
      });
    }
    // Agrupar en chunks consecutivos de 7 días
    const cols: Columna[] = [];
    const tam = 7;
    for (let i = 0, sem = 1; i < fechas.length; i += tam, sem++) {
      const chunk = fechas.slice(i, i + tam);
      const sum = new Array(24).fill(0);
      let dias = 0;
      for (const f of chunk) {
        const d = data.simulaciones.dias_detalle[f];
        if (!d) continue;
        for (let h = 0; h < 24; h++) sum[h] += d.gen[h] ?? 0;
        dias++;
      }
      const avg = sum.map((s) => (dias > 0 ? s / dias : 0));
      cols.push({
        etiqueta: `${sem}`,
        detalle: `Semana ${sem} (${chunk[0]} a ${chunk[chunk.length - 1]})`,
        valores: avg,
      });
    }
    return cols;
  }, [fechas, data.simulaciones.dias_detalle, agruparPorSemana]);

  const max = useMemo(() => {
    let m = 0;
    for (const c of columnas) for (const v of c.valores) if (v > m) m = v;
    return m;
  }, [columnas]);

  // Layout en viewBox del SVG
  const yLabelW = 30;
  const xLabelH = 22;
  const cellW = 14;
  const cellH = 14;
  const W = yLabelW + Math.max(1, columnas.length) * cellW;
  const H = xLabelH + 24 * cellH;

  // Cuántas etiquetas X mostrar (sub-muestrear para evitar overlap)
  const tickStep = Math.max(1, Math.ceil(columnas.length / 26));
  const ejeXTitulo = agruparPorSemana ? "Semana del periodo" : "Día del periodo";

  const [hover, setHover] = useState<{
    col: number;
    row: number;
    px: number;
    py: number;
  } | null>(null);

  const fmt = (n: number) =>
    new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 }).format(n);

  return (
    <div className="space-y-3">
      <div className="flex gap-4 items-start">
        <div className="relative flex-1">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            width="100%"
            height={H * 1.4}
            style={{ display: "block" }}
          >
            {/* Etiquetas Y (horas) */}
            {Array.from({ length: 24 }).map((_, h) => (
              <text
                key={`y-${h}`}
                x={yLabelW - 4}
                y={xLabelH + h * cellH + cellH * 0.7}
                fontSize={9}
                fill="hsl(var(--muted-foreground))"
                textAnchor="end"
              >
                {h}h
              </text>
            ))}

            {/* Etiquetas X (días o semanas) */}
            {columnas.map((c, i) => {
              if (i % tickStep !== 0 && i !== columnas.length - 1) return null;
              return (
                <text
                  key={`x-${i}`}
                  x={yLabelW + i * cellW + cellW / 2}
                  y={xLabelH - 6}
                  fontSize={9}
                  fill="hsl(var(--muted-foreground))"
                  textAnchor="middle"
                >
                  {c.etiqueta}
                </text>
              );
            })}

            {/* Celdas */}
            {columnas.map((c, i) =>
              c.valores.map((v, h) => {
                const t = max > 0 ? v / max : 0;
                return (
                  <rect
                    key={`c-${i}-${h}`}
                    x={yLabelW + i * cellW}
                    y={xLabelH + h * cellH}
                    width={cellW}
                    height={cellH}
                    fill={colorFor(t)}
                    onMouseEnter={(ev) => {
                      const rect = (
                        ev.currentTarget.ownerSVGElement?.parentElement as HTMLElement | null
                      )?.getBoundingClientRect();
                      setHover({
                        col: i,
                        row: h,
                        px:
                          (ev.clientX -
                            (rect?.left ?? 0)) /
                            (rect?.width ?? 1) *
                          100,
                        py:
                          (ev.clientY -
                            (rect?.top ?? 0)) /
                            (rect?.height ?? 1) *
                          100,
                      });
                    }}
                    onMouseLeave={() => setHover(null)}
                  />
                );
              }),
            )}
          </svg>

          {hover && (
            <div
              className="absolute pointer-events-none bg-card border border-border rounded-md shadow px-2 py-1 text-xs space-y-0.5 z-10"
              style={{
                left: `${Math.min(hover.px, 80)}%`,
                top: `${Math.min(hover.py, 85)}%`,
                transform: "translate(8px, 8px)",
              }}
            >
              <div className="font-semibold text-navy">
                {columnas[hover.col]?.detalle}
              </div>
              <div className="text-muted-foreground">
                Hora {hover.row}:00 — {hover.row + 1}:00
              </div>
              <div className="tabular-nums">
                <span className="font-medium">
                  {fmt(columnas[hover.col]?.valores[hover.row] ?? 0)} kW
                </span>{" "}
                promedio
              </div>
            </div>
          )}
        </div>

        {/* Leyenda de escala */}
        <div className="flex flex-row gap-1 shrink-0 pt-5">
          <div
            className="w-3 rounded"
            style={{
              height: H * 1.4 - 30,
              background:
                "linear-gradient(to top, rgb(255,255,229) 0%, rgb(254,217,118) 25%, rgb(253,141,60) 50%, rgb(240,59,32) 75%, rgb(177,0,38) 100%)",
            }}
          />
          <div
            className="flex flex-col justify-between text-[10px] text-muted-foreground tabular-nums"
            style={{ height: H * 1.4 - 30 }}
          >
            <span>{fmt(max)} kW</span>
            <span>{fmt(max / 2)} kW</span>
            <span>0 kW</span>
          </div>
        </div>
      </div>

      <div className="text-[10px] text-muted-foreground text-center">
        {ejeXTitulo}
      </div>
    </div>
  );
}
