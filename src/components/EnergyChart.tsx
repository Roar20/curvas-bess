import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import type { EnergyRecord } from '../types/energy';
import { buildDailyProfile } from '../utils/energy';

interface Props {
  records: EnergyRecord[];
  targetPeak?: number;
}

export default function EnergyChart({ records, targetPeak }: Props) {
  const profile = buildDailyProfile(records);
  const data = profile.map((p) => ({
    hour: `${String(p.hour).padStart(2, '0')}:00`,
    'Perfil Médio (kW)': parseFloat(p.power_kw.toFixed(2)),
  }));

  const recentDay = records.slice(-96); // last 96 x 15min slots = last day
  const hourMap: Record<number, number[]> = {};
  for (const r of recentDay) {
    const h = new Date(r.timestamp).getHours();
    if (!hourMap[h]) hourMap[h] = [];
    hourMap[h].push(r.power_kw);
  }
  const dailyData = data.map((d, i) => ({
    ...d,
    'Último Dia (kW)': hourMap[i]
      ? parseFloat((hourMap[i].reduce((a, b) => a + b, 0) / hourMap[i].length).toFixed(2))
      : undefined,
  }));

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Curva de Carga — Perfil Horário</h2>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={dailyData} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="hour"
            tick={{ fontSize: 11 }}
            interval={2}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            unit=" kW"
            width={60}
          />
          <Tooltip
            formatter={(value, name) => [
              `${typeof value === 'number' ? value.toFixed(1) : value} kW`,
              String(name),
            ]}
            labelFormatter={(label) => `Hora: ${label}`}
          />
          <Legend />
          {targetPeak !== undefined && targetPeak > 0 && (
            <ReferenceLine
              y={targetPeak}
              stroke="#ef4444"
              strokeDasharray="6 3"
              label={{ value: `Meta: ${targetPeak} kW`, position: 'right', fill: '#ef4444', fontSize: 11 }}
            />
          )}
          <Line
            type="monotone"
            dataKey="Perfil Médio (kW)"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="Último Dia (kW)"
            stroke="#10b981"
            strokeWidth={1.5}
            strokeDasharray="4 2"
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
