import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ResumenData } from "@/types/bess";
import { fmtN, fmtMXN } from "@/lib/bess-sim";

export function EstrategiaTablaTecnica({ data }: { data: ResumenData }) {
  const p2 = data.parte2!;
  const g = p2.greedy;
  const a = p2.arbitraje;
  const dias = data.meta.dias_analizados || 1;
  const factorAnual = 365 / dias;

  return (
    <Accordion
      type="single"
      collapsible
      className="bg-card rounded-xl border border-border px-5"
    >
      <AccordionItem value="t" className="border-0">
        <AccordionTrigger className="text-navy font-semibold">
          Ver desglose técnico de las dos estrategias
        </AccordionTrigger>
        <AccordionContent>
          <p className="text-xs text-muted-foreground mb-3">
            Comparativa detallada de operación y resultados económicos por
            estrategia. Precios usados:{" "}
            ${p2.precios_usados.energia_mxn_mwh.toFixed(2)}/MWh energía,{" "}
            ${p2.precios_usados.potencia_mxn_mw_mes.toLocaleString("es-MX")}/MW-mes
            potencia, ${p2.precios_usados.cel_mxn}/CEL.
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Métrica</TableHead>
                <TableHead className="text-right">Greedy</TableHead>
                <TableHead className="text-right">Arbitraje</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>Cargado anual (MWh)</TableCell>
                <TableCell className="text-right tabular-nums">
                  {fmtN((g.sim.cargado_kWh / 1000) * factorAnual, 1)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {fmtN((a.sim.cargado_kWh / 1000) * factorAnual, 1)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Descargado anual (MWh)</TableCell>
                <TableCell className="text-right tabular-nums">
                  {fmtN(g.ingreso.descargado_mwh_anual, 1)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {fmtN(a.ingreso.descargado_mwh_anual, 1)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Energía total al POI (MWh/año)</TableCell>
                <TableCell className="text-right tabular-nums">
                  {fmtN(g.ingreso.energia_total_mwh_anual, 1)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {fmtN(a.ingreso.energia_total_mwh_anual, 1)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Potencia firme (kW)</TableCell>
                <TableCell className="text-right tabular-nums">
                  {fmtN(g.ingreso.kw_firme_garantizable, 1)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {fmtN(a.ingreso.kw_firme_garantizable, 1)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Ingreso energía (MXN/año)</TableCell>
                <TableCell className="text-right tabular-nums">
                  {fmtMXN(g.ingreso.energia_mxn)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {fmtMXN(a.ingreso.energia_mxn)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Ingreso potencia firme (MXN/año)</TableCell>
                <TableCell className="text-right tabular-nums">
                  {fmtMXN(g.ingreso.potencia_mxn)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {fmtMXN(a.ingreso.potencia_mxn)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Ingreso CELs (MXN/año)</TableCell>
                <TableCell className="text-right tabular-nums">
                  {fmtMXN(g.ingreso.cels_mxn)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {fmtMXN(a.ingreso.cels_mxn)}
                </TableCell>
              </TableRow>
              <TableRow className="font-semibold">
                <TableCell>Total anual (MXN)</TableCell>
                <TableCell className="text-right tabular-nums">
                  {fmtMXN(g.ingreso.total_mxn)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {fmtMXN(a.ingreso.total_mxn)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
