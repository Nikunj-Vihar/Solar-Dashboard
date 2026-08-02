import { redirect } from "next/navigation";
import { getCurrentSite } from "@/lib/data/site";
import { getDashboardData } from "@/lib/data/dashboard";
import { computeHealthStatus } from "@/lib/calc/health";
import { resolveDateRange } from "@/lib/calc/range";
import { formatRangeLabel } from "@/lib/format";
import { todayInTimezone } from "@/lib/date";
import { SummaryRow } from "./SummaryRow";
import { InverterBarChart } from "./InverterBarChart";
import { TrendChart } from "./TrendChart";
import { ImpactFigures } from "./ImpactFigures";
import { PerformanceMetrics } from "./PerformanceMetrics";
import { GenerationHeatmap } from "./GenerationHeatmap";
import { LifetimeTrend } from "./LifetimeTrend";
import { DateRangeFilter } from "./DateRangeFilter";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const site = await getCurrentSite();
  if (!site) {
    redirect("/setup");
  }

  const { from, to } = await searchParams;
  const today = todayInTimezone(site.timezone);
  const range = resolveDateRange(from, to, today);
  const data = await getDashboardData(site, range);

  const healthStatus = computeHealthStatus(data.alerts);
  const totalDcCapacityKwp = site.inverters
    .filter((inv) => inv.is_active)
    .reduce((sum, inv) => sum + inv.dc_capacity_kwp, 0);
  const earliestDate = data.allReadings.reduce((min, r) => (r.date < min ? r.date : min), today);
  const rangeLabel = formatRangeLabel(range.from, range.to);
  const rangeAvgPerDayKwh =
    data.rangeTotalDays > 0 ? Math.round((data.rangeKwh / data.rangeTotalDays) * 100) / 100 : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{site.name}</h1>
        <DateRangeFilter today={today} earliestDate={earliestDate} />
      </div>

      <SummaryRow
        rangeKwh={data.rangeKwh}
        rangeAvgPerDayKwh={rangeAvgPerDayKwh}
        rangeLabel={rangeLabel}
        lifetimeKwh={data.lifetimeKwh}
        healthStatus={healthStatus}
      />

      <InverterBarChart data={data.perInverterRange} singleDay={data.rangeIsSingleDay} />

      <TrendChart readings={data.allReadings} baseline={data.baseline} today={data.today} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ImpactFigures
          rangeKwh={data.rangeKwh}
          rangeExpectedMidKwh={data.rangeExpectedMidKwh}
          rangeLabel={rangeLabel}
          tariffRateInrPerKwh={site.tariff_rate_inr_per_kwh}
          gridEmissionFactorKgPerKwh={site.grid_emission_factor_kg_per_kwh}
        />
        <PerformanceMetrics
          rangeKwh={data.rangeKwh}
          totalDcCapacityKwp={totalDcCapacityKwp}
          rangeDays={data.rangeTotalDays}
        />
      </div>

      <GenerationHeatmap readings={data.allReadings} today={data.today} />

      <LifetimeTrend readings={data.allReadings} today={data.today} />
    </div>
  );
}
