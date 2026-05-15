export interface EnergyRecord {
  timestamp: string;
  power_kw: number;
}

export interface DailyProfile {
  hour: number;
  power_kw: number;
}

export interface EnergyStats {
  peakDemand: number;
  avgDemand: number;
  minDemand: number;
  totalEnergy: number;
  loadFactor: number;
  peakHour: number;
}

export interface BESSConfig {
  targetPeakKw: number;
  efficiency: number;
  dod: number; // depth of discharge (0-1)
}

export interface BESSResult {
  requiredCapacityKwh: number;
  requiredPowerKw: number;
  annualSavingsKwh: number;
  peakReductionKw: number;
  chargeSchedule: { hour: number; action: 'charge' | 'discharge' | 'idle'; power_kw: number }[];
}
