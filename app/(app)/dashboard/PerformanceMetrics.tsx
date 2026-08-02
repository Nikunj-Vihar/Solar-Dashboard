import { Card, CardContent } from "@/components/ui/card";
import { InfoTooltip } from "@/components/InfoTooltip";
import { computeCUF, computeSpecificYield } from "@/lib/calc/kpis";
import { formatPercent } from "@/lib/format";

export function PerformanceMetrics({
  monthKwh,
  totalDcCapacityKwp,
  dayOfMonth,
}: {
  monthKwh: number;
  totalDcCapacityKwp: number;
  dayOfMonth: number;
}) {
  const cufPercent = computeCUF(monthKwh, totalDcCapacityKwp, dayOfMonth);
  const specificYield = computeSpecificYield(monthKwh, totalDcCapacityKwp);

  return (
    <>
      <Card>
        <CardContent className="pt-6">
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            Capacity utilization
            <InfoTooltip>
              Actual generation this month as a share of what your installed DC capacity could
              theoretically produce running flat-out, 24 hours a day. Real systems typically run
              15–25% due to daylight hours, weather, and panel angle — this isn&apos;t a defect,
              it&apos;s how solar works.
            </InfoTooltip>
          </p>
          <p className="mt-1 text-2xl font-semibold">{formatPercent(cufPercent)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            Specific yield
            <InfoTooltip>
              kWh generated this month per kWp of installed DC capacity — a standard way to
              compare performance across systems of different sizes.
            </InfoTooltip>
          </p>
          <p className="mt-1 text-2xl font-semibold">
            {specificYield.toLocaleString(undefined, { maximumFractionDigits: 1 })} kWh/kWp
          </p>
        </CardContent>
      </Card>
    </>
  );
}
