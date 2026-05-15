import { useRef, useState } from 'react';
import Papa from 'papaparse';
import { Upload, FileText, AlertCircle, Play } from 'lucide-react';
import type { EnergyRecord } from '../types/energy';
import { generateSampleData } from '../utils/energy';

interface Props {
  onData: (records: EnergyRecord[]) => void;
}

export default function DataUpload({ onData }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  function parseFile(file: File) {
    setError(null);
    setFileName(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        const records = parseRows(results.data);
        if (records.length === 0) {
          setError('Nenhum dado válido encontrado. Verifique o formato do arquivo.');
          return;
        }
        onData(records);
      },
      error(err) {
        setError(`Erro ao processar arquivo: ${err.message}`);
      },
    });
  }

  function parseRows(rows: Record<string, string>[]): EnergyRecord[] {
    const records: EnergyRecord[] = [];
    for (const row of rows) {
      const tsKey = Object.keys(row).find((k) =>
        ['timestamp', 'datetime', 'data', 'date', 'time', 'hora', 'dt'].includes(k.toLowerCase().trim())
      );
      const pwKey = Object.keys(row).find((k) =>
        ['power_kw', 'power', 'kw', 'potencia', 'potência', 'demand', 'demanda', 'load', 'carga', 'p'].includes(
          k.toLowerCase().trim()
        )
      );

      if (!tsKey || !pwKey) continue;
      const power = parseFloat(row[pwKey].replace(',', '.'));
      if (isNaN(power)) continue;

      const tsRaw = row[tsKey].trim();
      // Try to build a valid date
      const ts = new Date(tsRaw);
      const timestamp = isNaN(ts.getTime()) ? tsRaw : ts.toISOString();
      records.push({ timestamp, power_kw: power });
    }

    // If no valid timestamps, assign sequential 15-min slots from midnight today
    if (records.length > 0 && records.every((r) => isNaN(new Date(r.timestamp).getTime()))) {
      const base = new Date();
      base.setHours(0, 0, 0, 0);
      return records.map((r, i) => ({
        ...r,
        timestamp: new Date(base.getTime() + i * 15 * 60_000).toISOString(),
      }));
    }

    return records;
  }

  function handleFile(file: File | null | undefined) {
    if (!file) return;
    if (!file.name.match(/\.(csv|txt)$/i)) {
      setError('Por favor, envie um arquivo CSV.');
      return;
    }
    parseFile(file);
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <FileText className="w-5 h-5 text-blue-600" />
        Importar Dados de Consumo
      </h2>

      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
          dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
        }`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
      >
        <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-600 font-medium">Arraste um arquivo CSV ou clique para selecionar</p>
        <p className="text-gray-400 text-sm mt-1">
          Colunas esperadas: <code className="bg-gray-100 px-1 rounded">timestamp</code> e{' '}
          <code className="bg-gray-100 px-1 rounded">power_kw</code> (ou similares)
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.txt"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>

      {fileName && !error && (
        <p className="mt-3 text-sm text-green-600 flex items-center gap-1">
          <FileText className="w-4 h-4" /> {fileName} carregado com sucesso
        </p>
      )}
      {error && (
        <p className="mt-3 text-sm text-red-600 flex items-center gap-1">
          <AlertCircle className="w-4 h-4" /> {error}
        </p>
      )}

      <div className="mt-4 pt-4 border-t border-gray-100">
        <p className="text-sm text-gray-500 mb-2">Sem dados? Use o conjunto de dados de exemplo:</p>
        <button
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          onClick={() => { setFileName('dados_exemplo.csv'); setError(null); onData(generateSampleData()); }}
        >
          <Play className="w-4 h-4" /> Carregar Dados de Exemplo
        </button>
      </div>
    </div>
  );
}
