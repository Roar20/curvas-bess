import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { analizarPlanta } from "@/lib/analizar";
import { storage, type ConfigCliente } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Onboarding() {
  const navigate = useNavigate();

  const [archivo, setArchivo] = useState<File | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Datos del cliente
  const [nombre, setNombre] = useState("PV Estanzuela 2");
  const [cliente, setCliente] = useState("Soluciones MHG, S.A. de C.V.");
  const [ubicacion, setUbicacion] = useState("Teuchitlán, Jalisco, México");
  const [poi, setPoi] = useState(500);
  const [capInst, setCapInst] = useState(500);
  const [precio, setPrecio] = useState(1010.8);

  async function handleProcesar() {
    if (!archivo) {
      setError("Sube un archivo Excel primero.");
      return;
    }
    setProcesando(true);
    setError(null);
    try {
      const buffer = await archivo.arrayBuffer();
      const config: ConfigCliente = {
        nombre_planta: nombre,
        cliente,
        ubicacion,
        poi_kw: poi,
        cap_pv_instalada_kw: capInst,
        precio_ppa_mxn_mwh: precio,
      };
      const estado = await analizarPlanta(buffer, config);
      const ok = storage.guardarAnalisis(estado);
      if (!ok) {
        throw new Error(
          "No se pudo guardar en localStorage. Quizá el archivo es muy grande.",
        );
      }
      navigate("/reporte");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError("Error al procesar: " + msg);
      setProcesando(false);
    }
  }

  function handleCargarDemo() {
    if (storage.hayAnalisis()) {
      navigate("/reporte");
    } else {
      setError("No hay análisis guardado. Procesa un archivo primero.");
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-navy text-white">
        <div className="max-w-[1100px] mx-auto px-4 md:px-8 py-6">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
            Simulador BESS — Onboarding del proyecto
          </h1>
          <p className="text-sm text-white/70 mt-1">
            Sube el reporte de generación del cliente y configura los parámetros
            contractuales de la planta.
          </p>
        </div>
      </header>

      <main className="max-w-[1100px] mx-auto px-4 md:px-8 py-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-navy">1. Archivo de generación</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Formato esperado: Excel (.xlsx) con las columnas{" "}
              <strong>Día de Operación</strong>, <strong>Hora</strong> (1-24) y{" "}
              <strong>Energía Registrada [MWh]</strong>. Se aceptan reportes
              mensuales y anuales.
            </p>
            <Input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
            />
            {archivo && (
              <p className="text-xs text-muted-foreground">
                Archivo seleccionado: <strong>{archivo.name}</strong> (
                {(archivo.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-navy">2. Datos del cliente</CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="nombre">Nombre de la planta</Label>
              <Input
                id="nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="cliente">Cliente</Label>
              <Input
                id="cliente"
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="ubicacion">Ubicación</Label>
              <Input
                id="ubicacion"
                value={ubicacion}
                onChange={(e) => setUbicacion(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-navy">3. Parámetros contractuales</CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="poi">POI (kW)</Label>
              <Input
                id="poi"
                type="number"
                value={poi}
                onChange={(e) => setPoi(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Contrato de interconexión
              </p>
            </div>
            <div>
              <Label htmlFor="cap">PV instalada actual (kW)</Label>
              <Input
                id="cap"
                type="number"
                value={capInst}
                onChange={(e) => setCapInst(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Capacidad PV de hoy
              </p>
            </div>
            <div>
              <Label htmlFor="precio">Precio PPA (MXN/MWh)</Label>
              <Input
                id="precio"
                type="number"
                value={precio}
                onChange={(e) => setPrecio(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Precio por venta de energía
              </p>
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="rounded-md border border-warning/40 bg-warning/10 text-warning px-4 py-3 text-sm">
            {error}
          </div>
        )}

        <div className="flex flex-wrap gap-3 items-center">
          <Button
            onClick={handleProcesar}
            disabled={procesando || !archivo}
            className="bg-navy text-white hover:bg-navy/90"
          >
            {procesando ? "Procesando…" : "Procesar y ver reporte"}
          </Button>
          {storage.hayAnalisis() && (
            <Button
              variant="outline"
              onClick={handleCargarDemo}
              disabled={procesando}
            >
              Cargar análisis anterior
            </Button>
          )}
          {storage.hayAnalisis() && (
            <Button
              variant="ghost"
              onClick={() => {
                storage.borrarTodo();
                window.location.reload();
              }}
              disabled={procesando}
              className="text-muted-foreground"
            >
              Borrar datos guardados
            </Button>
          )}
        </div>

        <Card className="bg-sky-soft/30 border-sky/30">
          <CardContent className="pt-6 text-sm text-navy/80">
            <p className="font-semibold mb-2 text-navy">Cómo funciona</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>
                Procesamos el archivo y caracterizamos el comportamiento real de
                la planta (Parte 1, sin escalar nada).
              </li>
              <li>
                Generamos un diagnóstico automático y tres escenarios sugeridos
                (conservador, balanceado, agresivo).
              </li>
              <li>
                Pasamos a la pestaña Simulador donde puedes mover sliders y ver
                el efecto en vivo de cualquier configuración.
              </li>
              <li>
                Toda la información se guarda en este navegador. No se sube nada
                a un servidor.
              </li>
            </ol>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
