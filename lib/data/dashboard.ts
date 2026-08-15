import "server-only";
import { createClient } from "@/lib/supabase/server";
import { todayInTimezone, addDays } from "@/lib/date";
import { computeRangeFields } from "@/lib/calc/dashboardCompute";
import { RECENT_BASELINE_DEVIATION_DAYS } from "@/lib/calc/health";
import type { SiteWithInverters } from "./site";
import type { SkyCondition } from "@/lib/validation/schemas";

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
  /** One entry per date that has either a client-logged sky condition or
   * NASA POWER weather data (or both) -- see TrendChart's tooltip. */
  dailyClimate: {
    date: string;
    skyCondition: SkyCondition | null;
    note: string | null;
    avgDailyIrradianceKwhPerM2: number | null;
    cloudAmtPct: number | null;
    temperatureC: number | null;
    precipitationMm: number | null;
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

  const [
    { data: readings },
    { data: baselineRows },
    { data: alertRows },
    { data: skyConditionRows },
    { data: weatherRows },
  ] = await Promise.all([
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
    supabase
      .from("daily_sky_conditions")
      .select("reading_date, sky_condition, note")
      .eq("site_id", site.id),
    supabase
      .from("daily_weather_readings")
      .select("reading_date, avg_daily_irradiance_kwh_per_m2, cloud_amt_pct, temperature_c, precipitation_mm")
      .eq("site_id", site.id),
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

  const skyByDate = new Map((skyConditionRows ?? []).map((r) => [r.reading_date, r]));
  const weatherByDate = new Map((weatherRows ?? []).map((r) => [r.reading_date, r]));
  const climateDates = new Set([...skyByDate.keys(), ...weatherByDate.keys()]);
  const dailyClimate = Array.from(climateDates)
    .sort()
    .map((date) => {
      const sky = skyByDate.get(date);
      const weather = weatherByDate.get(date);
      return {
        date,
        skyCondition: (sky?.sky_condition as SkyCondition) ?? null,
        note: sky?.note ?? null,
        avgDailyIrradianceKwhPerM2: weather?.avg_daily_irradiance_kwh_per_m2 ?? null,
        cloudAmtPct: weather?.cloud_amt_pct ?? null,
        temperatureC: weather?.temperature_c ?? null,
        precipitationMm: weather?.precipitation_mm ?? null,
      };
    });

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
    dailyClimate,
  };
}

function sum(nums: number[]): number {
  return Math.round(nums.reduce((a, b) => a + b, 0) * 100) / 100;
}
