import { TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { InfoTooltip } from "@/components/InfoTooltip";
import { computeRupeeSaved, computeVsBaselinePercent } from "@/lib/calc/kpis";
import { formatInr, formatKwh, formatPercent } from "@/lib/format";

export function ImpactFigures({
  rangeKwh,
  rangeLastMonthKwh,
  rangeLabel,
  tariffRateInrPerKwh,
}: {
  rangeKwh: number;
  rangeLastMonthKwh: number | null;
  rangeLabel: string;
  tariffRateInrPerKwh: number | null;
}) {
  const rupeeSaved = computeRupeeSaved(rangeKwh, tariffRateInrPerKwh);
  const vsLastMonth =
    rangeLastMonthKwh !== null ? computeVsBaselinePercent(rangeKwh, rangeLastMonthKwh) : null;

  if (rupeeSaved === null) return null;

  return (
    <Card>
      <CardContent className="pt-6">
        <p className="flex items-center gap-1 text-sm text-muted-foreground">
          Estimated savings
          <InfoTooltip>
            <p>
              {formatKwh(rangeKwh)} generated in the selected period ({rangeLabel}) × your
              configured tariff rate of{" "}
              {tariffRateInrPerKwh !== null ? `₹${tariffRateInrPerKwh}/kWh` : ""}
              {" = "}what that electricity would have cost from the grid. An estimate, not a
              certified figure — change your tariff rate in Settings if it&apos;s out of date.
            </p>
            <p className="mt-2">
              &quot;vs. last month&quot; compares actual generation in the selected period to this
              same date range, one month earlier, from your site&apos;s own logged readings.
            </p>
          </InfoTooltip>
        </p>
        <p className="mt-1 text-2xl font-semibold">{formatInr(rupeeSaved)}</p>
        {vsLastMonth !== null && (
          <p
            className={`mt-1 flex items-center gap-1 text-sm ${
              vsLastMonth >= 0 ? "text-(--viz-status-good)" : "text-muted-foreground"
            }`}
          >
            {vsLastMonth >= 0 ? (
              <TrendingUp className="size-3.5" />
            ) : (
              <TrendingDown className="size-3.5" />
            )}
            {formatPercent(vsLastMonth, { showSign: true })} vs. last month for {rangeLabel}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
