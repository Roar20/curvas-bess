import { useState } from 'react';
import Header from './components/Header';
import DataUpload from './components/DataUpload';
import StatsPanel from './components/StatsPanel';
import EnergyChart from './components/EnergyChart';
import DurationCurve from './components/DurationCurve';
import BESSAnalysis from './components/BESSAnalysis';
import type { EnergyRecord, EnergyStats } from './types/energy';
import { computeStats, buildDailyProfile } from './utils/energy';

export default function App() {
  const [records, setRecords] = useState<EnergyRecord[]>([]);
  const [stats, setStats] = useState<EnergyStats | null>(null);
  const [targetPeak, setTargetPeak] = useState<number>(0);

  function handleData(data: EnergyRecord[]) {
    setRecords(data);
    const s = computeStats(data);
    setStats(s);
    setTargetPeak(Math.round(s.peakDemand * 0.75));
  }

  const profile = records.length > 0 ? buildDailyProfile(records) : [];

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <DataUpload onData={handleData} />

        {stats && records.length > 0 && (
          <>
            <StatsPanel stats={stats} />

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <EnergyChart records={records} targetPeak={targetPeak} />
              <DurationCurve records={records} />
            </div>

            <BESSAnalysis
              profile={profile}
              peakDemand={stats.peakDemand}
              onTargetPeakChange={setTargetPeak}
            />
          </>
        )}

        {records.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg">Importe dados de consumo para começar a análise</p>
            <p className="text-sm mt-1">Suporte para arquivos CSV com colunas de timestamp e potência (kW)</p>
          </div>
        )}
      </main>

      <footer className="text-center text-xs text-gray-400 py-6 border-t border-gray-200 mt-8">
        Curvas BESS — Battery Energy Storage System · Análise de Consumo de Energia
      </footer>
    </div>
  );
}
