import type { Metadata } from "next";
import { Sun } from "lucide-react";
import { fetchPublicSitePayload, computePublicDashboardData } from "@/lib/data/publicDashboard";
import { resolveDateRange } from "@/lib/calc/range";
import { todayInTimezone } from "@/lib/date";
import { formatRangeLabel } from "@/lib/format";
import { SummaryRow } from "@/app/(app)/dashboard/SummaryRow";
import { InverterBarChart } from "@/app/(app)/dashboard/InverterBarChart";
import { TrendChart } from "@/app/(app)/dashboard/TrendChart";
import { ImpactFigures } from "@/app/(app)/dashboard/ImpactFigures";
import { PerformanceMetrics } from "@/app/(app)/dashboard/PerformanceMetrics";
import { DateRangeFilter } from "@/app/(app)/dashboard/DateRangeFilter";

export const metadata: Metadata = {
  title: "Shared dashboard — Solar Dashboard",
  robots: { index: false, follow: false },
};

export default async function PublicDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { slug } = await params;
  const { from, to } = await searchParams;

  const payload = await fetchPublicSitePayload(slug);
  if (!payload) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-2 p-4 text-center">
        <Sun className="size-8 text-muted-foreground" />
        <h1 className="text-lg font-semibold">Link not found</h1>
        <p className="text-sm text-muted-foreground">
          This share link is invalid or is no longer public.
        </p>
      </div>
    );
  }

  const today = todayInTimezone(payload.timezone);
  const range = resolveDateRange(from, to, today);
  const dashboard = computePublicDashboardData(payload, range);
  const rangeLabel = formatRangeLabel(range.from, range.to);
  const rangeAvgPerDayKwh =
    dashboard.rangeTotalDays > 0
      ? Math.round((dashboard.rangeKwh / dashboard.rangeTotalDays) * 100) / 100
      : 0;

  return (
    <div className="min-h-svh bg-muted/20">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <Sun className="size-5 text-amber-500" />
            <span className="font-semibold">{dashboard.siteName}</span>
          </div>
          <span className="rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground">
            Public view — read only
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-4 p-4">
        <div className="flex justify-end">
          <DateRangeFilter today={today} earliestDate={dashboard.earliestDate} />
        </div>

        <SummaryRow
          rangeKwh={dashboard.rangeKwh}
          rangeAvgPerDayKwh={rangeAvgPerDayKwh}
          rangeLabel={rangeLabel}
          lifetimeKwh={dashboard.lifetimeKwh}
          healthStatus={dashboard.healthStatus}
          healthReason={dashboard.healthReason}
        />

        <InverterBarChart data={dashboard.perInverterRange} singleDay={dashboard.rangeIsSingleDay} />

        <TrendChart readings={dashboard.allReadings} baseline={dashboard.baseline} range={range} />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ImpactFigures
            rangeKwh={dashboard.rangeKwh}
            rangeExpectedMidKwh={dashboard.rangeExpectedMidKwh}
            rangeLabel={rangeLabel}
            tariffRateInrPerKwh={dashboard.tariffRateInrPerKwh}
            gridEmissionFactorKgPerKwh={dashboard.gridEmissionFactorKgPerKwh}
          />
          <PerformanceMetrics
            rangeKwh={dashboard.rangeKwh}
            totalDcCapacityKwp={dashboard.totalDcCapacityKwp}
            rangeDays={dashboard.rangeTotalDays}
          />
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Shared read-only view — figures are estimates and update as new readings are logged.
        </p>
      </main>
    </div>
  );
}
