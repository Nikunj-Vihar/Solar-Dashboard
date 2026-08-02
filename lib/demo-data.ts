/**
 * Deterministic fake dataset for /demo and the sample monthly-report PDF —
 * illustrative only, never touches Supabase or real client data. Fixed
 * pattern (not Math.random()) so screenshots and the generated PDF stay
 * stable across builds. Deliberately importable from a plain Node script
 * (scripts/generate-sample-pdf.ts), so nothing here may import "server-only"
 * or the Supabase client.
 */
import { todayInTimezone, addDays } from "@/lib/date";
import { computeRangeSummary, computeRangeExpectedMidKwh } from "@/lib/calc/range";

export const DEMO_SITE = {
  name: "Sunnyvale Rooftop Array",
  tariffRateInrPerKwh: 8.5,
  gridEmissionFactorKgPerKwh: 0.716,
  timezone: "Asia/Kolkata",
};

export const DEMO_INVERTERS = [
  { id: "demo-inv-1", name: "Inverter 1", ratedCapacityKw: 5.5, dcCapacityKwp: 6.6 },
  { id: "demo-inv-2", name: "Inverter 2", ratedCapacityKw: 5.5, dcCapacityKwp: 6.6 },
  { id: "demo-inv-3", name: "Inverter 3", ratedCapacityKw: 5.5, dcCapacityKwp: 6.6 },
  { id: "demo-inv-4", name: "Inverter 4", ratedCapacityKw: 5.5, dcCapacityKwp: 6.6 },
];

export const DEMO_BASELINE = Array.from({ length: 12 }, (_, i) => ({
  month: i + 1,
  expectedDailyKwhLow: 85,
  expectedDailyKwhMid: 100,
  expectedDailyKwhHigh: 115,
}));

export type DemoDashboardData = {
  today: string;
  todayKwh: number;
  monthKwh: number;
  lifetimeKwh: number;
  // The demo page freezes on "today" (matching the real dashboard's default
  // range before a visitor picks anything), so these are the same shape the
  // real getDashboardData returns for its range-driven fields.
  rangeKwh: number;
  rangeDaysWithData: number;
  rangeTotalDays: number;
  rangeExpectedMidKwh: number | null;
  perInverterRange: { inverterId: string; name: string; kwh: number; noReading: boolean }[];
  allReadings: { date: string; kwh: number }[];
  baseline: typeof DEMO_BASELINE;
  alerts: {
    id: string;
    message: string;
    severity: "watch" | "needs_attention";
    inverterId: string | null;
    readingDate: string;
  }[];
};

const DEMO_DAYS = 90;
const MISSING_READING_INVERTER_INDEX = 1; // Inverter 2 goes quiet for a few days
const MISSING_READING_GAP_DAYS_AGO = [3, 4, 5];
const UNDERPERFORMING_INVERTER_INDEX = 3; // Inverter 4 dips in the last week
const UNDERPERFORMING_WINDOW_DAYS = 7;

// Deterministic pseudo-random in [0, 1) — a fixed pattern, not Math.random().
function hash(n: number): number {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export function generateDemoReadings(
  today: string,
): { date: string; inverterId: string; kwh: number }[] {
  const readings: { date: string; inverterId: string; kwh: number }[] = [];

  for (let d = DEMO_DAYS - 1; d >= 0; d--) {
    const date = addDays(today, -d);
    for (let i = 0; i < DEMO_INVERTERS.length; i++) {
      if (i === MISSING_READING_INVERTER_INDEX && MISSING_READING_GAP_DAYS_AGO.includes(d)) {
        continue;
      }
      const seasonal = Math.sin((DEMO_DAYS - d) / 14) * 4;
      const noise = (hash(d * 10 + i) - 0.5) * 4;
      let kwh = 24 + seasonal + noise;
      if (i === UNDERPERFORMING_INVERTER_INDEX && d < UNDERPERFORMING_WINDOW_DAYS) {
        kwh *= 0.45;
      }
      kwh = Math.max(kwh, 2);
      readings.push({ date, inverterId: DEMO_INVERTERS[i].id, kwh: Math.round(kwh * 100) / 100 });
    }
  }

  return readings;
}

export function getDemoDashboardData(): DemoDashboardData {
  const today = todayInTimezone(DEMO_SITE.timezone);
  const currentMonth = today.slice(0, 7);
  const readings = generateDemoReadings(today);

  const todayRows = readings.filter((r) => r.date === today);
  const monthRows = readings.filter((r) => r.date.startsWith(currentMonth));

  // Frozen on "today" -- same default range the real dashboard starts on.
  const perInverterRange = DEMO_INVERTERS.map((inv) => ({
    inverterId: inv.id,
    name: inv.name,
    kwh: todayRows.find((r) => r.inverterId === inv.id)?.kwh ?? 0,
    noReading: false, // demo data never has an explicit no-reading gap
  }));

  const allReadings = readings.map((r) => ({ date: r.date, kwh: r.kwh }));
  const rangeSummary = computeRangeSummary(allReadings, today, today);

  const lastMissingDay = addDays(today, -Math.min(...MISSING_READING_GAP_DAYS_AGO));

  return {
    today,
    todayKwh: round2(sum(todayRows.map((r) => r.kwh))),
    monthKwh: round2(sum(monthRows.map((r) => r.kwh))),
    lifetimeKwh: round2(sum(readings.map((r) => r.kwh))),
    rangeKwh: rangeSummary.actualKwh,
    rangeDaysWithData: rangeSummary.daysWithData,
    rangeTotalDays: rangeSummary.totalDays,
    rangeExpectedMidKwh: computeRangeExpectedMidKwh(today, today, DEMO_BASELINE),
    perInverterRange,
    allReadings,
    baseline: DEMO_BASELINE,
    alerts: [
      {
        id: "demo-alert-underperformance",
        message:
          "Inverter 4's generation is 55% below its 30-day average (last 7 days: 12.9 kWh/day vs 25.1 kWh/day).",
        severity: "watch",
        inverterId: DEMO_INVERTERS[3].id,
        readingDate: today,
      },
      {
        id: "demo-alert-missing",
        message: `No reading logged for Inverter 2 for 3 days (last: ${formatShortDate(lastMissingDay)}).`,
        severity: "watch",
        inverterId: DEMO_INVERTERS[1].id,
        readingDate: today,
      },
    ],
  };
}

function sum(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0);
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function formatShortDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
