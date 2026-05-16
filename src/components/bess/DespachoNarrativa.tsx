import type { ResumenData } from "@/types/bess";

interface Props {
  data: ResumenData;
}

export function DespachoNarrativa({ data }: Props) {
  const e = data.estadisticos_excedente;
  const horas = Math.round(e.duracion_promedio_h);
  const horaInicio = Math.round(e.h_inicio_promedio);
  const horaFin = Math.round(e.h_fin_promedio);
  const sinExcedente = e.duracion_promedio_h <= 0.5;

  return (
    <div className="bg-card rounded-xl border border-border p-6 leading-relaxed text-base text-foreground">
      {sinExcedente ? (
        <>
          La planta no presenta excedente significativo en el periodo
          analizado. La batería tendría poco material que almacenar y su
          beneficio económico es marginal en estas condiciones.
        </>
      ) : (
        <>
          Durante <strong>{horas} horas del día</strong> ({horaInicio}h–
          {horaFin}h), tu planta genera más energía de la que puede inyectar
          a la red. La batería propuesta captura ese sobrante y lo entrega
          cuando la energía vale más, entre las <strong>18h y 22h</strong>.
        </>
      )}
    </div>
  );
}
