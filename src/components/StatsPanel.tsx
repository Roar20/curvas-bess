import type { EnergyStats } from '../types/energy';
import { TrendingUp, TrendingDown, Zap, Activity, Clock, Percent } from 'lucide-react';

interface Props {
  stats: EnergyStats;
}

function StatCard({
  label,
  value,
  unit,
  icon,
  color,
}: {
  label: string;
  value: string;
  unit: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-200 p-5`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {value}
            <span className="text-sm font-normal text-gray-500 ml-1">{unit}</span>
          </p>
        </div>
        <div className={`p-2 rounded-lg ${color}`}>{icon}</div>
      </div>
    </div>
  );
}

export default function StatsPanel({ stats }: Props) {
  const { peakDemand, avgDemand, minDemand, totalEnergy, loadFactor, peakHour } = stats;

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Indicadores de Consumo</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard
          label="Demanda de Pico"
          value={peakDemand.toFixed(1)}
          unit="kW"
          icon={<TrendingUp className="w-5 h-5 text-red-600" />}
          color="bg-red-50"
        />
        <StatCard
          label="Demanda Média"
          value={avgDemand.toFixed(1)}
          unit="kW"
          icon={<Activity className="w-5 h-5 text-blue-600" />}
          color="bg-blue-50"
        />
        <StatCard
          label="Demanda Mínima"
          value={minDemand.toFixed(1)}
          unit="kW"
          icon={<TrendingDown className="w-5 h-5 text-green-600" />}
          color="bg-green-50"
        />
        <StatCard
          label="Energia Total"
          value={totalEnergy.toFixed(0)}
          unit="kWh"
          icon={<Zap className="w-5 h-5 text-yellow-600" />}
          color="bg-yellow-50"
        />
        <StatCard
          label="Fator de Carga"
          value={(loadFactor * 100).toFixed(1)}
          unit="%"
          icon={<Percent className="w-5 h-5 text-purple-600" />}
          color="bg-purple-50"
        />
        <StatCard
          label="Hora de Pico"
          value={`${String(peakHour).padStart(2, '0')}:00`}
          unit=""
          icon={<Clock className="w-5 h-5 text-orange-600" />}
          color="bg-orange-50"
        />
      </div>
    </div>
  );
}
