import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { EnergyRecord } from '../types/energy';
import { buildLoadDurationCurve } from '../utils/energy';

interface Props {
  records: EnergyRecord[];
}

export default function DurationCurve({ records }: Props) {
  const curve = buildLoadDurationCurve(records);

  // Downsample to 100 points for display
  const step = Math.max(1, Math.floor(curve.length / 100));
  const data = curve.filter((_, i) => i % step === 0).map((d) => ({
    '%': d.rank,
    'Potência (kW)': parseFloat(d.power_kw.toFixed(2)),
  }));

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-1">Curva de Duração de Carga</h2>
      <p className="text-sm text-gray-500 mb-4">
        Mostra por qual percentual do tempo cada nível de potência foi superado
      </p>
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="durationGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="%" unit="%" tick={{ fontSize: 11 }} />
          <YAxis unit=" kW" tick={{ fontSize: 11 }} width={60} />
          <Tooltip
            formatter={(value) => [
              `${typeof value === 'number' ? value.toFixed(1) : value} kW`,
              'Potência',
            ]}
            labelFormatter={(label) => `${label}% do tempo`}
          />
          <Area
            type="monotone"
            dataKey="Potência (kW)"
            stroke="#6366f1"
            strokeWidth={2}
            fill="url(#durationGrad)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
