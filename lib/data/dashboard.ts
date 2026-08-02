import "server-only";
import { createClient } from "@/lib/supabase/server";
import { todayInTimezone, addDays } from "@/lib/date";
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
  perInverterToday: { inverterId: string; name: string; kwh: number; noReading: boolean }[];
  perInverterMonth: { inverterId: string; name: string; kwh: number }[];
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

export async function getDashboardData(site: SiteWithInverters): Promise<DashboardData> {
  const supabase = await createClient();
  const today = todayInTimezone(site.timezone);
  const currentMonth = today.slice(0, 7);

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

  const perInverterToday = site.inverters
    .filter((inv) => inv.is_active)
    .map((inv) => {
      const row = todayRows.find((r) => r.inverter_id === inv.id);
      return {
        inverterId: inv.id,
        name: inv.name,
        kwh: row?.daily_kwh ?? 0,
        noReading: row?.no_reading ?? false,
      };
    });

  const perInverterMonth = site.inverters
    .filter((inv) => inv.is_active)
    .map((inv) => ({
      inverterId: inv.id,
      name: inv.name,
      kwh: sum(realKwh(monthRows.filter((r) => r.inverter_id === inv.id))),
    }));

  return {
    today,
    todayKwh: sum(realKwh(todayRows)),
    monthKwh: sum(realKwh(monthRows)),
    lifetimeKwh: sum(realKwh(rows)),
    perInverterToday,
    perInverterMonth,
    allReadings: rows.map((r) => ({ date: r.reading_date, kwh: r.daily_kwh })),
    baseline: (baselineRows ?? []).map((b) => ({
      month: b.month,
      expectedDailyKwhLow: b.expected_daily_kwh_low,
      expectedDailyKwhMid: b.expected_daily_kwh_mid,
      expectedDailyKwhHigh: b.expected_daily_kwh_high,
    })),
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
