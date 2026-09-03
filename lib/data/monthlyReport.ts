import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { computeRangeFields } from "@/lib/calc/dashboardCompute";
import { densifyDailyTotals } from "@/lib/calc/trend";
import { computeMonthlyReport, type MonthlyReportData } from "@/lib/calc/monthlyReport";
import { monthBounds } from "@/lib/calc/reportPeriod";
import { todayInTimezone } from "@/lib/date";
import { getLoggedDatesForSite } from "./readings";
import type { SiteWithInverters } from "./site";

/**
 * Builds a full monthly report for one site/month from real data. Takes an
 * already-authorized Supabase client so the same function serves both the
 * user-session route (RLS-scoped) and the internal, service-role route the
 * generation-report Edge Function calls to attach a PDF to its email --
 * one implementation instead of two that could drift.
 *
 * Returns null when nothing was logged that month (nothing to report).
 */
export async function getMonthlyReportData(
  supabase: SupabaseClient,
  site: SiteWithInverters,
  year: number,
  month: number,
): Promise<MonthlyReportData | null> {
  const { from, to, daysInMonth } = monthBounds(year, month);
  const activeInverters = site.inverters.filter((inv) => inv.is_active);

  const [{ data: readings }, { data: alertRows }] = await Promise.all([
    supabase
      .from("daily_readings")
      .select("reading_date, inverter_id, daily_kwh, cumulative_mwh, no_reading")
      .eq("site_id", site.id)
      .order("reading_date"),
    supabase
      .from("alerts")
      .select("message")
      .eq("site_id", site.id)
      .eq("is_resolved", false)
      .gte("reading_date", from)
      .lte("reading_date", to),
  ]);

  const rows = readings ?? [];
  const rangeFields = computeRangeFields(rows, activeInverters, { from, to });
  if (rangeFields.rangeDaysWithData === 0) return null;

  const monthRows = rows.filter((r) => r.reading_date >= from && r.reading_date <= to);
  const dailySeries = densifyDailyTotals(
    monthRows.map((r) => ({ date: r.reading_date, kwh: r.daily_kwh })),
    from,
    to,
  ).map((d) => ({ date: d.date, kwh: d.totalKwh }));

  // Cross-check against the daily-kWh total, the way the client reads the
  // meter themselves: each inverter's cumulative (lifetime) reading on the
  // last day it was logged this month, minus its reading on the first day
  // logged this month -- summed across inverters. Only ever compares within
  // the same month (never reaches into the previous month's last reading),
  // matching how the client described it. An inverter with fewer than two
  // real cumulative readings this month can't produce a delta and is
  // skipped; if none can, the whole figure is null ("--" in the report)
  // rather than a misleading 0.
  let cumulativeGenerationMwh: number | null = null;
  for (const inv of activeInverters) {
    const invReadings = monthRows
      .filter((r) => r.inverter_id === inv.id && r.cumulative_mwh !== null)
      .sort((a, b) => (a.reading_date < b.reading_date ? -1 : 1));
    if (invReadings.length < 2) continue;
    const delta =
      (invReadings[invReadings.length - 1].cumulative_mwh as number) -
      (invReadings[0].cumulative_mwh as number);
    cumulativeGenerationMwh = (cumulativeGenerationMwh ?? 0) + delta;
  }

  const totalDcCapacityKwp = activeInverters.reduce((sum, inv) => sum + inv.dc_capacity_kwp, 0);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://solar-dashboard-flax.vercel.app";

  return computeMonthlyReport({
    siteName: site.name,
    year,
    month,
    daysInMonth,
    totalKwh: rangeFields.rangeKwh,
    previousMonthKwh: rangeFields.rangeLastMonthKwh,
    previousYearKwh: rangeFields.rangeLastYearKwh,
    totalDcCapacityKwp,
    tariffRateInrPerKwh: site.tariff_rate_inr_per_kwh,
    gridEmissionFactorKgPerKwh: site.grid_emission_factor_kg_per_kwh,
    perInverterKwh: rangeFields.perInverterRange.map((p) => ({ name: p.name, kwh: p.kwh })),
    alertMessages: (alertRows ?? []).map((a) => a.message),
    dashboardUrl: `${siteUrl}/dashboard`,
    rangeDaysWithData: rangeFields.rangeDaysWithData,
    rangeTotalDays: rangeFields.rangeTotalDays,
    dailySeries,
    lifetimeKwh: rangeFields.lifetimeKwh,
    cumulativeGenerationMwh,
  });
}

/** value: YYYY-MM, label: "August 2026" */
export type AvailableReportMonth = { value: string; label: string };

/** Distinct completed (non-current) calendar months with at least one real reading, newest first. */
export async function getAvailableReportMonths(
  siteId: string,
  timezone: string,
): Promise<AvailableReportMonth[]> {
  const currentYearMonth = todayInTimezone(timezone).slice(0, 7);
  const { logged } = await getLoggedDatesForSite(siteId);

  const months = new Set<string>();
  for (const date of logged) {
    const yearMonth = date.slice(0, 7);
    if (yearMonth < currentYearMonth) months.add(yearMonth);
  }

  return [...months]
    .sort()
    .reverse()
    .map((yearMonth) => {
      const [year, month] = yearMonth.split("-").map(Number);
      const label = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });
      return { value: yearMonth, label };
    });
}
