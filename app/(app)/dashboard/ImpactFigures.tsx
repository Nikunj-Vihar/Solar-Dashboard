import { TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { computeRupeeSaved, computeCo2OffsetKg, computeVsBaselinePercent } from "@/lib/calc/kpis";
import { formatInr, formatKwh, formatPercent } from "@/lib/format";

export function ImpactFigures({
  monthKwh,
  monthExpectedMidKwh,
  tariffRateInrPerKwh,
  gridEmissionFactorKgPerKwh,
}: {
  monthKwh: number;
  monthExpectedMidKwh: number | null;
  tariffRateInrPerKwh: number | null;
  gridEmissionFactorKgPerKwh: number;
}) {
  const rupeeSaved = computeRupeeSaved(monthKwh, tariffRateInrPerKwh);
  const co2OffsetKg = computeCo2OffsetKg(monthKwh, gridEmissionFactorKgPerKwh);
  const vsBaseline =
    monthExpectedMidKwh !== null ? computeVsBaselinePercent(monthKwh, monthExpectedMidKwh) : null;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {rupeeSaved !== null && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Estimated savings this month</p>
            <p className="mt-1 text-2xl font-semibold">{formatInr(rupeeSaved)}</p>
            {vsBaseline !== null && (
              <p
                className={`mt-1 flex items-center gap-1 text-sm ${
                  vsBaseline >= 0 ? "text-[--viz-status-good]" : "text-muted-foreground"
                }`}
              >
                {vsBaseline >= 0 ? (
                  <TrendingUp className="size-3.5" />
                ) : (
                  <TrendingDown className="size-3.5" />
                )}
                {formatPercent(vsBaseline, { showSign: true })} vs. expected for this month
              </p>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              Estimate based on your configured tariff rate — not a certified figure.
            </p>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Estimated CO2 offset this month</p>
          <p className="mt-1 text-2xl font-semibold">
            {co2OffsetKg.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatKwh(monthKwh)} generated · approximate, based on a standard grid emission
            factor.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
