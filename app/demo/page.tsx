import type { Metadata } from "next";
import { Sun, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getDemoDashboardData, DEMO_SITE, DEMO_INVERTERS } from "@/lib/demo-data";
import { computeHealthStatus } from "@/lib/calc/health";
import { SummaryRow } from "@/app/(app)/dashboard/SummaryRow";
import { InverterBarChart } from "@/app/(app)/dashboard/InverterBarChart";
import { TrendChart } from "@/app/(app)/dashboard/TrendChart";
import { ImpactFigures } from "@/app/(app)/dashboard/ImpactFigures";
import { PerformanceMetrics } from "@/app/(app)/dashboard/PerformanceMetrics";
import { GenerationHeatmap } from "@/app/(app)/dashboard/GenerationHeatmap";
import { LifetimeTrend } from "@/app/(app)/dashboard/LifetimeTrend";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Sample dashboard — Solar Dashboard",
  description: "A preview of what your dashboard will look like once you're logging data.",
  robots: { index: false, follow: false },
};

export default function DemoPage() {
  const data = getDemoDashboardData();
  const healthStatus = computeHealthStatus(data.alerts);

  const currentMonthNumber = Number(data.today.slice(5, 7));
  const dayOfMonth = Number(data.today.slice(8, 10));
  const currentMonthBaseline = data.baseline.find((b) => b.month === currentMonthNumber);
  const monthExpectedMidKwh = currentMonthBaseline
    ? currentMonthBaseline.expectedDailyKwhMid * dayOfMonth
    : null;
  const totalDcCapacityKwp = DEMO_INVERTERS.reduce((sum, inv) => sum + inv.dcCapacityKwp, 0);

  return (
    <div className="min-h-svh bg-muted/20">
      <div className="sticky top-0 z-10 border-b bg-amber-50 px-4 py-2 text-center text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
        Sample data shown for illustration — this is what your dashboard will look like once
        you&apos;re logging readings.
      </div>
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-4">
          <div className="flex items-center gap-2">
            <Sun className="size-5 text-amber-500" />
            <span className="font-semibold">{DEMO_SITE.name}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<a href="/sample-monthly-report.pdf" download />}
          >
            <FileDown className="size-4" />
            Sample monthly report (PDF)
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-4 p-4">
        <SummaryRow
          todayKwh={data.todayKwh}
          monthKwh={data.monthKwh}
          lifetimeKwh={data.lifetimeKwh}
          healthStatus={healthStatus}
        />
        <InverterBarChart today={data.perInverterToday} month={data.perInverterMonth} />
        <TrendChart readings={data.allReadings} baseline={data.baseline} today={data.today} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ImpactFigures
            monthKwh={data.monthKwh}
            monthExpectedMidKwh={monthExpectedMidKwh}
            tariffRateInrPerKwh={DEMO_SITE.tariffRateInrPerKwh}
            gridEmissionFactorKgPerKwh={DEMO_SITE.gridEmissionFactorKgPerKwh}
          />
          <PerformanceMetrics
            monthKwh={data.monthKwh}
            totalDcCapacityKwp={totalDcCapacityKwp}
            dayOfMonth={dayOfMonth}
          />
        </div>
        <GenerationHeatmap readings={data.allReadings} today={data.today} />
        <LifetimeTrend readings={data.allReadings} today={data.today} />
      </main>
    </div>
  );
}
