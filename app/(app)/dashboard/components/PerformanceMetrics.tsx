import { Card, CardContent } from "@/components/ui/card";
import { InfoTooltip } from "@/components/InfoTooltip";
import { computeCUF, computeSpecificYield } from "@/lib/calc/kpis";
import { formatPercent } from "@/lib/format";

export function PerformanceMetrics({
  rangeKwh,
  totalDcCapacityKwp,
  rangeDays,
}: {
  rangeKwh: number;
  totalDcCapacityKwp: number;
  rangeDays: number;
}) {
  const cufPercent = computeCUF(rangeKwh, totalDcCapacityKwp, rangeDays);
  const specificYield = computeSpecificYield(rangeKwh, totalDcCapacityKwp);

  return (
    <>
      <Card>
        <CardContent className="pt-6">
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            Capacity utilization
            <InfoTooltip>
              Actual generation in the selected period as a share of what your installed DC
              capacity could theoretically produce running flat-out, 24 hours a day. Real systems
              typically run 15–25% due to daylight hours, weather, and panel angle — this
              isn&apos;t a defect, it&apos;s how solar works.
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
              kWh generated in the selected period per kWp of installed DC capacity — a standard
              way to compare performance across systems of different sizes.
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
