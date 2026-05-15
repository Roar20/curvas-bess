import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { Battery, Settings } from 'lucide-react';
import type { DailyProfile, BESSConfig, BESSResult } from '../types/energy';
import { analyzeBESS } from '../utils/energy';

interface Props {
  profile: DailyProfile[];
  peakDemand: number;
  onTargetPeakChange: (kw: number) => void;
}

export default function BESSAnalysis({ profile, peakDemand, onTargetPeakChange }: Props) {
  const [config, setConfig] = useState<BESSConfig>({
    targetPeakKw: Math.round(peakDemand * 0.75),
    efficiency: 0.92,
    dod: 0.8,
  });
  const [result, setResult] = useState<BESSResult | null>(null);

  function handleAnalyze() {
    const r = analyzeBESS(profile, config);
    setResult(r);
    onTargetPeakChange(config.targetPeakKw);
  }

  const scheduleData = profile.map((slot) => {
    const sched = result?.chargeSchedule.find((s) => s.hour === slot.hour);
    return {
      hour: `${String(slot.hour).padStart(2, '0')}:00`,
      Demanda: parseFloat(slot.power_kw.toFixed(2)),
      Descarga: sched?.action === 'discharge' ? parseFloat(sched.power_kw.toFixed(2)) : 0,
      Carga: sched?.action === 'charge' ? parseFloat(sched.power_kw.toFixed(2)) : 0,
    };
  });

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <Battery className="w-5 h-5 text-blue-600" />
        Análise BESS — Dimensionamento de Bateria
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
        <div>
          <label className="block text-sm text-gray-600 mb-1 font-medium">Meta de Corte de Pico (kW)</label>
          <input
            type="number"
            min={1}
            max={Math.round(peakDemand)}
            value={config.targetPeakKw}
            onChange={(e) =>
              setConfig((c) => ({ ...c, targetPeakKw: Math.max(1, parseFloat(e.target.value) || 1) }))
            }
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <p className="text-xs text-gray-400 mt-1">Pico atual: {peakDemand.toFixed(0)} kW</p>
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1 font-medium">Eficiência (%)</label>
          <input
            type="number"
            min={50}
            max={100}
            value={Math.round(config.efficiency * 100)}
            onChange={(e) =>
              setConfig((c) => ({ ...c, efficiency: Math.min(1, Math.max(0.5, parseFloat(e.target.value) / 100)) }))
            }
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1 font-medium">Profundidade de Descarga (%)</label>
          <input
            type="number"
            min={10}
            max={100}
            value={Math.round(config.dod * 100)}
            onChange={(e) =>
              setConfig((c) => ({ ...c, dod: Math.min(1, Math.max(0.1, parseFloat(e.target.value) / 100)) }))
            }
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
      </div>

      <button
        className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors mb-5"
        onClick={handleAnalyze}
      >
        <Settings className="w-4 h-4" /> Calcular Dimensionamento BESS
      </button>

      {result && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <p className="text-xs text-blue-600 font-medium">Capacidade Necessária</p>
              <p className="text-xl font-bold text-blue-800">{result.requiredCapacityKwh.toFixed(0)}</p>
              <p className="text-xs text-blue-500">kWh</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <p className="text-xs text-green-600 font-medium">Potência BESS</p>
              <p className="text-xl font-bold text-green-800">{result.requiredPowerKw.toFixed(0)}</p>
              <p className="text-xs text-green-500">kW</p>
            </div>
            <div className="bg-red-50 rounded-lg p-3 text-center">
              <p className="text-xs text-red-600 font-medium">Redução de Pico</p>
              <p className="text-xl font-bold text-red-800">{Math.max(0, result.peakReductionKw).toFixed(0)}</p>
              <p className="text-xs text-red-500">kW</p>
            </div>
            <div className="bg-yellow-50 rounded-lg p-3 text-center">
              <p className="text-xs text-yellow-700 font-medium">Energia Deslocada/Ano</p>
              <p className="text-xl font-bold text-yellow-800">{result.annualSavingsKwh.toFixed(0)}</p>
              <p className="text-xs text-yellow-600">kWh/ano</p>
            </div>
          </div>

          <h3 className="text-sm font-semibold text-gray-700 mb-3">Estratégia de Operação do BESS</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={scheduleData} margin={{ top: 4, right: 24, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={2} />
              <YAxis unit=" kW" tick={{ fontSize: 11 }} width={60} />
              <Tooltip formatter={(v, n) => [`${typeof v === 'number' ? v.toFixed(1) : v} kW`, String(n)]} />
              <Legend />
              <Bar dataKey="Demanda" fill="#93c5fd" radius={[2, 2, 0, 0]}>
                {scheduleData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.Demanda > config.targetPeakKw ? '#fca5a5' : '#93c5fd'}
                  />
                ))}
              </Bar>
              <Bar dataKey="Descarga" fill="#10b981" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Carga" fill="#a78bfa" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </>
      )}
    </div>
  );
}
