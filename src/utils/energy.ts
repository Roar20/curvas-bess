import type { EnergyRecord, DailyProfile, EnergyStats, BESSConfig, BESSResult } from '../types/energy';

export function computeStats(records: EnergyRecord[]): EnergyStats {
  if (records.length === 0) {
    return { peakDemand: 0, avgDemand: 0, minDemand: 0, totalEnergy: 0, loadFactor: 0, peakHour: 0 };
  }

  const powers = records.map((r) => r.power_kw);
  const peakDemand = Math.max(...powers);
  const minDemand = Math.min(...powers);
  const avgDemand = powers.reduce((a, b) => a + b, 0) / powers.length;
  // Assume 15-min intervals by default; detect from data if possible
  const intervalHours = records.length > 1 ? detectIntervalHours(records) : 0.25;
  const totalEnergy = powers.reduce((a, b) => a + b, 0) * intervalHours;
  const loadFactor = peakDemand > 0 ? avgDemand / peakDemand : 0;
  const peakIdx = powers.indexOf(peakDemand);
  const peakHour = parseHour(records[peakIdx].timestamp);

  return { peakDemand, avgDemand, minDemand, totalEnergy, loadFactor, peakHour };
}

function detectIntervalHours(records: EnergyRecord[]): number {
  try {
    const t1 = new Date(records[0].timestamp).getTime();
    const t2 = new Date(records[1].timestamp).getTime();
    const diffMs = Math.abs(t2 - t1);
    if (diffMs > 0) return diffMs / 3_600_000;
  } catch {
    // ignore
  }
  return 0.25;
}

function parseHour(timestamp: string): number {
  try {
    return new Date(timestamp).getHours();
  } catch {
    return 0;
  }
}

export function buildDailyProfile(records: EnergyRecord[]): DailyProfile[] {
  const hourBuckets: number[][] = Array.from({ length: 24 }, () => []);
  for (const r of records) {
    const h = parseHour(r.timestamp);
    hourBuckets[h].push(r.power_kw);
  }
  return hourBuckets.map((bucket, hour) => ({
    hour,
    power_kw: bucket.length > 0 ? bucket.reduce((a, b) => a + b, 0) / bucket.length : 0,
  }));
}

export function buildLoadDurationCurve(records: EnergyRecord[]): { rank: number; power_kw: number }[] {
  const sorted = [...records].sort((a, b) => b.power_kw - a.power_kw);
  return sorted.map((r, i) => ({
    rank: Math.round((i / sorted.length) * 100),
    power_kw: r.power_kw,
  }));
}

export function analyzeBESS(profile: DailyProfile[], config: BESSConfig): BESSResult {
  const { targetPeakKw, efficiency, dod } = config;

  const chargeSchedule: BESSResult['chargeSchedule'] = [];
  let dischargeEnergyKwh = 0;

  for (const slot of profile) {
    if (slot.power_kw > targetPeakKw) {
      const excess = slot.power_kw - targetPeakKw;
      chargeSchedule.push({ hour: slot.hour, action: 'discharge', power_kw: excess });
      dischargeEnergyKwh += excess; // 1h slots for daily profile
    } else if (slot.power_kw < targetPeakKw * 0.5) {
      chargeSchedule.push({ hour: slot.hour, action: 'charge', power_kw: targetPeakKw * 0.2 });
    } else {
      chargeSchedule.push({ hour: slot.hour, action: 'idle', power_kw: 0 });
    }
  }

  const requiredCapacityKwh = dod > 0 ? dischargeEnergyKwh / (dod * efficiency) : dischargeEnergyKwh;
  const peakPowers = profile.filter((s) => s.power_kw > targetPeakKw).map((s) => s.power_kw - targetPeakKw);
  const requiredPowerKw = peakPowers.length > 0 ? Math.max(...peakPowers) : 0;
  const peakReductionKw = Math.max(...profile.map((s) => s.power_kw)) - targetPeakKw;
  const annualSavingsKwh = dischargeEnergyKwh * 365;

  return { requiredCapacityKwh, requiredPowerKw, annualSavingsKwh, peakReductionKw, chargeSchedule };
}

export function generateSampleData(): EnergyRecord[] {
  const records: EnergyRecord[] = [];
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  // Generate 7 days of 15-min interval data
  for (let day = 0; day < 7; day++) {
    for (let slot = 0; slot < 96; slot++) {
      const ts = new Date(now.getTime() - (6 - day) * 86_400_000 + slot * 15 * 60_000);
      const hour = ts.getHours() + ts.getMinutes() / 60;

      // Typical commercial load profile
      let base = 120;
      if (hour >= 8 && hour < 18) base = 350 + 80 * Math.sin((Math.PI * (hour - 8)) / 10);
      if (hour >= 12 && hour < 14) base *= 0.85; // lunch dip
      if (hour >= 18 && hour < 22) base = 200 + 40 * Math.sin((Math.PI * (hour - 18)) / 4);
      const noise = (Math.random() - 0.5) * 30;

      records.push({ timestamp: ts.toISOString(), power_kw: Math.max(0, base + noise) });
    }
  }

  return records;
}
