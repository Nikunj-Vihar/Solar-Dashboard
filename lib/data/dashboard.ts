import "server-only";
import { createClient } from "@/lib/supabase/server";
import { todayInTimezone, addDays } from "@/lib/date";
import { computeRangeFields } from "@/lib/calc/dashboardCompute";
import { RECENT_BASELINE_DEVIATION_DAYS } from "@/lib/calc/health";
import type { SiteWithInverters } from "./site";

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
  // Real (non-skipped) rows only, for the summed totals below -- a "no
  // reading" row's null daily_kwh should contribute nothing, not a 0.
  const realKwh = (rs: typeof rows) =>
    rs.filter((r) => r.daily_kwh !== null).map((r) => r.daily_kwh as number);

  const baseline = (baselineRows ?? []).map((b) => ({
    month: b.month,
    expectedDailyKwhLow: b.expected_daily_kwh_low,
    expectedDailyKwhMid: b.expected_daily_kwh_mid,
    expectedDailyKwhHigh: b.expected_daily_kwh_high,
  }));

  const activeInverters = site.inverters.filter((inv) => inv.is_active);
  const rangeFields = computeRangeFields(rows, activeInverters, effectiveRange, baseline);

  return {
    today,
    todayKwh: sum(realKwh(todayRows)),
    monthKwh: sum(realKwh(monthRows)),
    lifetimeKwh: rangeFields.lifetimeKwh,
    range: effectiveRange,
    rangeKwh: rangeFields.rangeKwh,
    rangeDaysWithData: rangeFields.rangeDaysWithData,
    rangeTotalDays: rangeFields.rangeTotalDays,
    rangeExpectedMidKwh: rangeFields.rangeExpectedMidKwh,
    rangeIsSingleDay: rangeFields.rangeIsSingleDay,
    perInverterRange: rangeFields.perInverterRange,
    allReadings: rows.map((r) => ({ date: r.reading_date, kwh: r.daily_kwh })),
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
