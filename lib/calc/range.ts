/**
 * Pure math for the dashboard's date-range filter — separate from trend.ts's
 * bucketing (day/week/month points for a chart) because this only needs one
 * summed total plus an expected baseline for whatever arbitrary range the
 * user picked, not a series of points.
 */
import { addDays, isValidDateString } from "@/lib/date";
import { densifyDailyTotals, type MonthlyBaselineRow } from "./trend";

export type RangeSummary = {
  actualKwh: number;
  daysWithData: number;
  totalDays: number;
};

export function computeRangeSummary(
  readings: { date: string; kwh: number | null }[],
  from: string,
  to: string,
): RangeSummary {
  const dense = densifyDailyTotals(readings, from, to);
  let actualKwh = 0;
  let daysWithData = 0;
  for (const { totalKwh } of dense) {
    if (totalKwh !== null) {
      actualKwh += totalKwh;
      daysWithData++;
    }
  }
  return { actualKwh: round2(actualKwh), daysWithData, totalDays: dense.length };
}

/** Sums each day's month-level expected mid value across the range. Null only if no baseline exists at all. */
export function computeRangeExpectedMidKwh(
  from: string,
  to: string,
  baseline: MonthlyBaselineRow[],
): number | null {
  if (baseline.length === 0) return null;
  const baselineByMonth = new Map(baseline.map((b) => [b.month, b]));
  let total = 0;
  let d = from;
  while (d <= to) {
    total += baselineByMonth.get(Number(d.slice(5, 7)))?.expectedDailyKwhMid ?? 0;
    d = addDays(d, 1);
  }
  return round2(total);
}

/**
 * Validates and clamps ?from=/?to= search params into a safe range: falls
 * back to today for anything missing/malformed, never allows a future end
 * date, and swaps a backwards range rather than erroring.
 */
export function resolveDateRange(
  fromParam: string | undefined,
  toParam: string | undefined,
  today: string,
): { from: string; to: string } {
  const from = fromParam && isValidDateString(fromParam) ? fromParam : today;
  const to = toParam && isValidDateString(toParam) ? (toParam > today ? today : toParam) : today;
  return from > to ? { from: to, to: from } : { from, to };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
