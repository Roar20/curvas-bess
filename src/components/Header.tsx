import { Battery, Zap } from 'lucide-react';

export default function Header() {
  return (
    <header className="bg-gradient-to-r from-blue-900 to-blue-700 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Battery className="w-8 h-8 text-yellow-400" />
          <Zap className="w-6 h-6 text-yellow-300" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Curvas BESS</h1>
          <p className="text-blue-200 text-sm">Battery Energy Storage System — Análise de Consumo de Energia</p>
        </div>
      </div>
    </header>
  );
}
