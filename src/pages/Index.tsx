import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { CrudosData, ResumenData } from "@/types/bess";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { TabDiagnostico } from "@/components/bess/TabDiagnostico";
import { TabResumen } from "@/components/bess/TabResumen";
import { TabExcedente } from "@/components/bess/TabExcedente";
import { TabPerfil } from "@/components/bess/TabPerfil";
import { TabSimulador } from "@/components/bess/TabSimulador";
import { TabPareto } from "@/components/bess/TabPareto";
import { TabDecision } from "@/components/bess/TabDecision";
import { storage } from "@/lib/storage";
import { recalcularConPropuesta } from "@/lib/analizar";

const Index = () => {
  const navigate = useNavigate();
  const [resumen, setResumen] = useState<ResumenData | null>(null);
  const [crudos, setCrudos] = useState<CrudosData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Sliders del simulador (compartidos con tab perfil)
  const [P, setP] = useState(400);
  const [E, setE] = useState(1600);
  const [DOD, setDOD] = useState(95);
  const [RTE, setRTE] = useState(85);

  useEffect(() => {
    // Si hay análisis en localStorage, cargarlo
    const estado = storage.cargarAnalisis();
    if (estado) {
      setResumen(estado.resumen);
      setCrudos(estado.crudos);
      setP(estado.propuesta.bess_p_kw);
      setE(estado.propuesta.bess_e_kwh);
      setDOD(estado.propuesta.dod_pct);
      setRTE(estado.propuesta.rte_pct);
      return;
    }
    // Si no, intentar cargar el JSON estático (modo demo legacy)
    fetch("/datos_resumen.json")
      .then((r) => r.json())
      .then(setResumen)
      .catch((e) => setError(String(e)));
    fetch("/datos_crudos.json")
      .then((r) => r.json())
      .then(setCrudos)
      .catch(() => {});
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-warning text-center">
          Error cargando datos: {error}
        </p>
        <Button onClick={() => navigate("/onboarding")}>
          Ir al onboarding
        </Button>
      </div>
    );
  }

  if (!resumen) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-muted-foreground px-4">
        <p>Cargando datos del análisis…</p>
        <Button
          variant="outline"
          onClick={() => navigate("/onboarding")}
          className="mt-2"
        >
          Cargar nuevo archivo
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-navy text-white">
        <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-6 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
              Dimensionamiento BESS · {resumen.meta.sitio}
            </h1>
            <p className="text-sm text-white/70 mt-1">
              {resumen.meta.ubicacion} · {resumen.meta.periodo_analizado} ·{" "}
              {resumen.meta.dias_analizados} días ·{" "}
              {resumen.meta.registros_totales.toLocaleString("es-MX")} registros
              @ 5 min
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/onboarding")}
            className="bg-white/10 text-white border-white/20 hover:bg-white/20 hover:text-white"
          >
            Cargar otra planta
          </Button>
        </div>
      </header>

      <main className="max-w-[1280px] mx-auto px-4 md:px-8 py-8">
        <Tabs defaultValue="diagnostico" className="space-y-6">
          <TabsList className="w-full flex flex-wrap h-auto justify-start bg-card border border-border p-1.5 rounded-xl">
            <TabsTrigger
              value="diagnostico"
              className="data-[state=active]:bg-navy data-[state=active]:text-white"
            >
              Diagnóstico
            </TabsTrigger>
            <TabsTrigger
              value="resumen"
              className="data-[state=active]:bg-navy data-[state=active]:text-white"
            >
              Resumen
            </TabsTrigger>
            <TabsTrigger
              value="excedente"
              className="data-[state=active]:bg-navy data-[state=active]:text-white"
            >
              Excedente diario
            </TabsTrigger>
            <TabsTrigger
              value="perfil"
              className="data-[state=active]:bg-navy data-[state=active]:text-white"
            >
              Perfil horario
            </TabsTrigger>
            <TabsTrigger
              value="simulador"
              className="data-[state=active]:bg-navy data-[state=active]:text-white"
            >
              Simulador
            </TabsTrigger>
            <TabsTrigger
              value="pareto"
              className="data-[state=active]:bg-navy data-[state=active]:text-white"
            >
              Pareto
            </TabsTrigger>
            <TabsTrigger
              value="decision"
              className="data-[state=active]:bg-navy data-[state=active]:text-white"
            >
              Decisión
            </TabsTrigger>
          </TabsList>

          <TabsContent value="diagnostico" className="mt-6">
            <TabDiagnostico data={resumen} />
          </TabsContent>
          <TabsContent value="resumen" className="mt-6">
            <TabResumen data={resumen} />
          </TabsContent>
          <TabsContent value="excedente" className="mt-6">
            <TabExcedente data={resumen} />
          </TabsContent>
          <TabsContent value="perfil" className="mt-6">
            <TabPerfil data={resumen} P_kW={P} E_kWh={E} />
          </TabsContent>
          <TabsContent value="simulador" className="mt-6">
            <TabSimulador
              data={resumen}
              crudos={crudos}
              P_kW={P}
              E_kWh={E}
              DOD={DOD}
              RTE={RTE}
              setP={setP}
              setE={setE}
              setDOD={setDOD}
              setRTE={setRTE}
            />
          </TabsContent>
          <TabsContent value="pareto" className="mt-6">
            <TabPareto data={resumen} />
          </TabsContent>
          <TabsContent value="decision" className="mt-6">
            <TabDecision data={resumen} />
          </TabsContent>
        </Tabs>
      </main>

      <footer className="border-t border-border mt-12 py-6">
        <div className="max-w-[1280px] mx-auto px-4 md:px-8 text-xs text-muted-foreground text-center">
          Análisis basado en datos cincominutales · Modelo de simulación BESS
        </div>
      </footer>
    </div>
  );
};

export default Index;
