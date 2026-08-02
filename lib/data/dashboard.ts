import "server-only";
import { createClient } from "@/lib/supabase/server";
import { todayInTimezone, addDays } from "@/lib/date";
import { computeRangeSummary, computeRangeExpectedMidKwh } from "@/lib/calc/range";
import type { SiteWithInverters } from "./site";

// baseline_deviation is a per-day event log by design (one row per date a
// site's total deviated from its baseline), not an ongoing condition --
// unlike underperformance/missing_reading, nothing ever marks an old day's
// deviation "resolved" once that day has passed. Left unbounded, health
// status would get stuck on a single bad day from months ago forever. Only
// count it toward "current" health within a short recent window; the other
// alert types self-resolve correctly on their own and stay unbounded.
const RECENT_BASELINE_DEVIATION_DAYS = 3;

export type DashboardData = {
  today: string;
  todayKwh: number;
  monthKwh: number;
  lifetimeKwh: number;
  /** The resolved date range the caller asked for (defaults to today-only). */
  range: { from: string; to: string };
  rangeKwh: number;
  rangeDaysWithData: number;
  rangeTotalDays: number;
  rangeExpectedMidKwh: number | null;
  rangeIsSingleDay: boolean;
  perInverterRange: { inverterId: string; name: string; kwh: number; noReading: boolean }[];
  allReadings: { date: string; kwh: number | null }[];
  baseline: {
    month: number;
    expectedDailyKwhLow: number;
    expectedDailyKwhMid: number;
    expectedDailyKwhHigh: number;
  }[];
  alerts: {
    id: string;
    message: string;
    severity: "watch" | "needs_attention";
    inverterId: string | null;
    readingDate: string;
  }[];
};

export async function getDashboardData(
  site: SiteWithInverters,
  range?: { from: string; to: string },
): Promise<DashboardData> {
  const supabase = await createClient();
  const today = todayInTimezone(site.timezone);
  const currentMonth = today.slice(0, 7);
  const effectiveRange = range ?? { from: today, to: today };

  const [{ data: readings }, { data: baselineRows }, { data: alertRows }] = await Promise.all([
    supabase
      .from("daily_readings")
      .select("reading_date, inverter_id, daily_kwh, no_reading")
      .eq("site_id", site.id)
      .order("reading_date"),
    supabase
      .from("expected_baseline_monthly")
      .select("month, expected_daily_kwh_low, expected_daily_kwh_mid, expected_daily_kwh_high")
      .eq("site_id", site.id)
      .order("month"),
    supabase
      .from("alerts")
      .select("id, message, severity, inverter_id, reading_date")
      .eq("site_id", site.id)
      .eq("is_resolved", false)
      .or(
        `alert_type.neq.baseline_deviation,reading_date.gte.${addDays(today, -RECENT_BASELINE_DEVIATION_DAYS)}`,
      )
      .order("created_at", { ascending: false }),
  ]);

  const rows = readings ?? [];
  const todayRows = rows.filter((r) => r.reading_date === today);
  const monthRows = rows.filter((r) => r.reading_date.startsWith(currentMonth));
  const rangeRows = rows.filter(
    (r) => r.reading_date >= effectiveRange.from && r.reading_date <= effectiveRange.to,
  );
  // Real (non-skipped) rows only, for the summed totals below -- a "no
  // reading" row's null daily_kwh should contribute nothing, not a 0.
  const realKwh = (rs: typeof rows) =>
    rs.filter((r) => r.daily_kwh !== null).map((r) => r.daily_kwh as number);

  const rangeIsSingleDay = effectiveRange.from === effectiveRange.to;

  // "No reading" only means something for a single specific day -- across a
  // multi-day range it's ambiguous, so it's left false and simply unused by
  // callers outside the single-day case (e.g. the underperformance check).
  const perInverterRange = site.inverters
    .filter((inv) => inv.is_active)
    .map((inv) => {
      const invRows = rangeRows.filter((r) => r.inverter_id === inv.id);
      return {
        inverterId: inv.id,
        name: inv.name,
        kwh: sum(realKwh(invRows)),
        noReading: rangeIsSingleDay ? (invRows[0]?.no_reading ?? false) : false,
      };
    });

  const baseline = (baselineRows ?? []).map((b) => ({
    month: b.month,
    expectedDailyKwhLow: b.expected_daily_kwh_low,
    expectedDailyKwhMid: b.expected_daily_kwh_mid,
    expectedDailyKwhHigh: b.expected_daily_kwh_high,
  }));

  const allReadings = rows.map((r) => ({ date: r.reading_date, kwh: r.daily_kwh }));
  const rangeSummary = computeRangeSummary(allReadings, effectiveRange.from, effectiveRange.to);

  return {
    today,
    todayKwh: sum(realKwh(todayRows)),
    monthKwh: sum(realKwh(monthRows)),
    lifetimeKwh: sum(realKwh(rows)),
    range: effectiveRange,
    rangeKwh: rangeSummary.actualKwh,
    rangeDaysWithData: rangeSummary.daysWithData,
    rangeTotalDays: rangeSummary.totalDays,
    rangeExpectedMidKwh: computeRangeExpectedMidKwh(
      effectiveRange.from,
      effectiveRange.to,
      baseline,
    ),
    rangeIsSingleDay,
    perInverterRange,
    allReadings,
    baseline,
    alerts: (alertRows ?? []).map((a) => ({
      id: a.id,
      message: a.message,
      severity: a.severity as "watch" | "needs_attention",
      inverterId: a.inverter_id,
      readingDate: a.reading_date,
    })),
  };
}

function sum(nums: number[]): number {
  return Math.round(nums.reduce((a, b) => a + b, 0) * 100) / 100;
}
