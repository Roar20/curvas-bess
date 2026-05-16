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
import { fmtN } from "@/lib/bess-sim";

export type FilaHora = {
  hora: number;
  gen: number;
  excedente: number;
  carga: number;
  descarga: number;
  soc: number;
  perdido: number;
};

export function DespachoTablaTecnica({ filas }: { filas: FilaHora[] }) {
  return (
    <Accordion
      type="single"
      collapsible
      className="bg-card rounded-xl border border-border px-5"
    >
      <AccordionItem value="t" className="border-0">
        <AccordionTrigger className="text-navy font-semibold">
          Ver detalles técnicos del despacho
        </AccordionTrigger>
        <AccordionContent>
          <p className="text-xs text-muted-foreground mb-3">
            Promedio horario sobre el periodo analizado. Valores en kWh
            (energía durante esa hora) y SoC en kWh (estado de carga al
            cierre de la hora).
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hora</TableHead>
                <TableHead className="text-right">PV bruta (kWh)</TableHead>
                <TableHead className="text-right">Excedente (kWh)</TableHead>
                <TableHead className="text-right">Carga BESS (kWh)</TableHead>
                <TableHead className="text-right">
                  Descarga BESS (kWh)
                </TableHead>
                <TableHead className="text-right">SoC (kWh)</TableHead>
                <TableHead className="text-right">Perdido (kWh)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((f) => (
                <TableRow key={f.hora}>
                  <TableCell className="font-medium tabular-nums">
                    {String(f.hora).padStart(2, "0")}:00
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtN(f.gen, 1)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtN(f.excedente, 1)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtN(f.carga, 1)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtN(f.descarga, 1)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtN(f.soc, 1)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtN(f.perdido, 1)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
