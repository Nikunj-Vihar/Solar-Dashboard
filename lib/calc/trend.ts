import { addDays } from "@/lib/date";

/**
 * Buckets a dense daily-readings series (one entry per day, 0 where nothing
 * was logged) into day/week/month points for the trend chart, summing the
 * matching baseline band alongside so actual and expected stay aligned.
 */

export type DailyReadingTotal = { date: string; totalKwh: number };

export type MonthlyBaselineRow = {
  month: number; // 1-12
  expectedDailyKwhLow: number;
  expectedDailyKwhMid: number;
  expectedDailyKwhHigh: number;
};

export type TrendGranularity = "day" | "week" | "month";

export type TrendPoint = {
  label: string;
  date: string;
  actualKwh: number;
  expectedLowKwh: number;
  expectedMidKwh: number;
  expectedHighKwh: number;
};

function monthOf(dateStr: string): number {
  return Number(dateStr.slice(5, 7));
}

function bucketKey(dateStr: string, granularity: TrendGranularity): string {
  if (granularity === "day") return dateStr;
  if (granularity === "month") return dateStr.slice(0, 7);

  // Week: Monday-anchored.
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = d.getUTCDay(); // 0=Sun..6=Sat
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diffToMonday);
  return d.toISOString().slice(0, 10);
}

function labelFor(key: string, granularity: TrendGranularity): string {
  if (granularity === "month") {
    const [y, m] = key.split("-").map(Number);
    // "Jun '26" rather than a bare "Jun 26", which reads as a day-of-month.
    const month = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", { month: "short" });
    return `${month} '${String(y).slice(2)}`;
  }
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function buildTrendData(
  readings: DailyReadingTotal[],
  baseline: MonthlyBaselineRow[],
  granularity: TrendGranularity,
): TrendPoint[] {
  const baselineByMonth = new Map(baseline.map((b) => [b.month, b]));
  const buckets = new Map<string, { actual: number; low: number; mid: number; high: number }>();

  for (const { date, totalKwh } of readings) {
    const key = bucketKey(date, granularity);
    const b = baselineByMonth.get(monthOf(date));
    const bucket = buckets.get(key) ?? { actual: 0, low: 0, mid: 0, high: 0 };
    bucket.actual += totalKwh;
    bucket.low += b?.expectedDailyKwhLow ?? 0;
    bucket.mid += b?.expectedDailyKwhMid ?? 0;
    bucket.high += b?.expectedDailyKwhHigh ?? 0;
    buckets.set(key, bucket);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([key, v]) => ({
      label: labelFor(key, granularity),
      date: key,
      actualKwh: round2(v.actual),
      expectedLowKwh: round2(v.low),
      expectedMidKwh: round2(v.mid),
      expectedHighKwh: round2(v.high),
    }));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Fills in zero-kWh entries for any day with no reading between fromDate and
 * toDate (inclusive), so gaps show honestly as dips rather than being
 * silently skipped over in the chart.
 */
export function densifyDailyTotals(
  readings: { date: string; kwh: number }[],
  fromDate: string,
  toDate: string,
): DailyReadingTotal[] {
  const totals = new Map<string, number>();
  for (const r of readings) {
    totals.set(r.date, (totals.get(r.date) ?? 0) + r.kwh);
  }

  const result: DailyReadingTotal[] = [];
  let d = fromDate;
  while (d <= toDate) {
    result.push({ date: d, totalKwh: round2(totals.get(d) ?? 0) });
    d = addDays(d, 1);
  }
  return result;
}
