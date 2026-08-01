import type { MonthlyIrradiance } from "./nasaPower";

// Performance Ratio band per spec §2: healthy PR is ~75-85%, below ~70%
// signals a real problem. We don't have measured irradiance so we can't
// compute true PR — instead we use these PR assumptions against the NASA
// POWER baseline to produce a genuine low/mid/high expected-generation band.
const PR_LOW = 0.65;
const PR_MID = 0.75;
const PR_HIGH = 0.85;

export type MonthlyBaseline = {
  month: number; // 1-12
  avgDailyIrradianceKwhPerM2: number;
  expectedDailyKwhLow: number;
  expectedDailyKwhMid: number;
  expectedDailyKwhHigh: number;
};

export function computeMonthlyBaseline(
  irradiance: MonthlyIrradiance,
  totalDcCapacityKwp: number,
): MonthlyBaseline[] {
  if (!(totalDcCapacityKwp > 0)) {
    throw new Error("Total DC capacity must be a positive number");
  }

  return irradiance.map(({ month, avgDailyIrradianceKwhPerM2 }) => ({
    month,
    avgDailyIrradianceKwhPerM2,
    expectedDailyKwhLow: round2(avgDailyIrradianceKwhPerM2 * totalDcCapacityKwp * PR_LOW),
    expectedDailyKwhMid: round2(avgDailyIrradianceKwhPerM2 * totalDcCapacityKwp * PR_MID),
    expectedDailyKwhHigh: round2(avgDailyIrradianceKwhPerM2 * totalDcCapacityKwp * PR_HIGH),
  }));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
