import "server-only";
import { createClient } from "@/lib/supabase/server";
import { todayInTimezone } from "@/lib/date";
import type { SiteWithInverters } from "./site";

export type DashboardData = {
  today: string;
  todayKwh: number;
  monthKwh: number;
  lifetimeKwh: number;
  perInverterToday: { inverterId: string; name: string; kwh: number }[];
  allReadings: { date: string; kwh: number }[];
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
      .select("reading_date, inverter_id, daily_kwh")
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
      .order("created_at", { ascending: false }),
  ]);

  const rows = readings ?? [];
  const todayRows = rows.filter((r) => r.reading_date === today);
  const monthRows = rows.filter((r) => r.reading_date.startsWith(currentMonth));

  const perInverterToday = site.inverters
    .filter((inv) => inv.is_active)
    .map((inv) => ({
      inverterId: inv.id,
      name: inv.name,
      kwh: todayRows.find((r) => r.inverter_id === inv.id)?.daily_kwh ?? 0,
    }));

  return {
    today,
    todayKwh: sum(todayRows.map((r) => r.daily_kwh)),
    monthKwh: sum(monthRows.map((r) => r.daily_kwh)),
    lifetimeKwh: sum(rows.map((r) => r.daily_kwh)),
    perInverterToday,
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
